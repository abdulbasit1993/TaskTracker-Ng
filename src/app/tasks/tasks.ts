import { DatePipe } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Task } from '../models/task';
import { TaskService } from '../services/task.service';

type TaskFilter = 'all' | 'pending' | 'completed';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './tasks.html',
  styleUrl: './tasks.css',
})
export class Tasks implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  // Reactive component state
  tasks = signal<Task[]>([]);
  isLoading = signal(false);
  errorMessage = signal('');
  isSubmitting = signal(false);
  actionError = signal('');

  updatingTaskIds = signal<number[]>([]);
  deletingTaskIds = signal<number[]>([]);
  savingTaskIds = signal<number[]>([]);

  editingTaskId = signal<number | null>(null);
  confirmingDeleteId = signal<number | null>(null);

  editTaskTitle = '';
  editTaskDescription = '';

  newTaskTitle = '';
  newTaskDescription = '';

  activeFilter = signal<TaskFilter>('all');
  searchQuery = signal('');

  // Static values
  readonly today = new Date();
  readonly currentYear = signal(this.today.getFullYear());
  readonly skeletonRows = [1, 2, 3];

  // Derived state
  completedCount = computed(() => this.tasks().filter((task) => task.isCompleted).length);

  remainingCount = computed(() => this.tasks().length - this.completedCount());

  progressPercent = computed(() => {
    const total = this.tasks().length;
    return total === 0 ? 0 : Math.round((this.completedCount() / total) * 100);
  });

  hasSearch = computed(() => this.searchQuery().trim().length > 0);

  filteredTasks = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    let tasks = this.tasks();

    switch (this.activeFilter()) {
      case 'pending':
        tasks = tasks.filter((task) => !task.isCompleted);
        break;
      case 'completed':
        tasks = tasks.filter((task) => task.isCompleted);
        break;
    }

    if (query) {
      tasks = tasks.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          (task.description ?? '').toLowerCase().includes(query),
      );
    }

    return tasks;
  });

  ngOnInit(): void {
    this.loadTasks();
  }

  // Per-task busy-state helpers keep the template readable.
  isUpdating(id: number): boolean {
    return this.updatingTaskIds().includes(id);
  }

  isSaving(id: number): boolean {
    return this.savingTaskIds().includes(id);
  }

  isDeleting(id: number): boolean {
    return this.deletingTaskIds().includes(id);
  }

  loadTasks(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.taskService.getTasks().subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load tasks: ', error);

        this.errorMessage.set('Unable to load tasks. Please check that the API is running.');
        this.isLoading.set(false);
      },
    });
  }

  addTask(): void {
    const title = this.newTaskTitle.trim();
    const description = this.newTaskDescription.trim();

    if (!title || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.actionError.set('');

    this.taskService.createTask(title, description).subscribe({
      next: (createdTask) => {
        this.tasks.update((tasks) => [createdTask, ...tasks]);

        this.newTaskTitle = '';
        this.newTaskDescription = '';
        this.activeFilter.set('all');
        this.searchQuery.set('');
        this.isSubmitting.set(false);
      },
      error: (error) => {
        console.error('Failed to create task: ', error);

        this.actionError.set(
          error.status === 0
            ? 'Unable to connect to the API. Please check that the backend server is running.'
            : 'Unable to create the task. Please try again.',
        );

        this.isSubmitting.set(false);
      },
    });
  }

  toggleTask(id: number, event: Event): void {
    const checkbox = event.target as HTMLInputElement;

    // Prevent duplicate requests for the same task.
    if (this.isUpdating(id)) {
      return;
    }

    const task = this.tasks().find((item) => item.id === id);

    if (!task) {
      return;
    }

    const previousIsCompleted = task.isCompleted;
    const newIsCompleted = !previousIsCompleted;

    this.actionError.set('');
    this.updatingTaskIds.update((ids) => [...ids, id]);

    this.taskService.updateTaskCompletion(id, newIsCompleted).subscribe({
      next: () => {
        this.tasks.update((tasks) =>
          tasks.map((item) =>
            item.id === id
              ? {
                  ...item,
                  isCompleted: newIsCompleted,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        );

        this.updatingTaskIds.update((ids) => ids.filter((taskId) => taskId !== id));
      },
      error: (error) => {
        console.error('Failed to update task completion: ', error);

        this.actionError.set('Unable to update the task. Please try again.');

        // Put the checkbox back to the state the task is actually in.
        checkbox.checked = previousIsCompleted;

        this.updatingTaskIds.update((ids) => ids.filter((taskId) => taskId !== id));
      },
    });
  }

  startEditing(task: Task): void {
    this.actionError.set('');
    this.confirmingDeleteId.set(null);

    this.editingTaskId.set(task.id);
    this.editTaskTitle = task.title;
    this.editTaskDescription = task.description ?? '';

    // Move focus into the edit form once it has rendered.
    setTimeout(() => {
      this.host.nativeElement
        .querySelector<HTMLInputElement>('.edit-task-form input[type="text"]')
        ?.focus();
    });
  }

  cancelEditing(): void {
    this.editingTaskId.set(null);
    this.editTaskTitle = '';
    this.editTaskDescription = '';
    this.actionError.set('');
  }

  saveTask(id: number): void {
    const title = this.editTaskTitle.trim();
    const description = this.editTaskDescription.trim();

    if (!title || this.isSaving(id)) {
      return;
    }

    this.actionError.set('');
    this.savingTaskIds.update((ids) => [...ids, id]);

    this.taskService.updateTask(id, title, description).subscribe({
      next: () => {
        this.tasks.update((tasks) =>
          tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  title,
                  description: description || null,
                  updatedAt: new Date().toISOString(),
                }
              : task,
          ),
        );

        this.savingTaskIds.update((ids) => ids.filter((taskId) => taskId !== id));

        this.cancelEditing();
      },
      error: (error) => {
        console.error('Failed to update task: ', error);

        this.actionError.set(
          error.status === 0
            ? 'Unable to connect to the server. Please check that the backend server is running.'
            : 'Unable to save changes. Please try again.',
        );

        this.savingTaskIds.update((ids) => ids.filter((taskId) => taskId !== id));
      },
    });
  }

  // Step 1 of deleting: ask for confirmation inline (replaces window.confirm).
  requestDelete(id: number): void {
    this.actionError.set('');
    this.confirmingDeleteId.set(id);
  }

  cancelDelete(): void {
    this.confirmingDeleteId.set(null);
  }

  // Step 2 of deleting: the user confirmed.
  deleteTask(id: number): void {
    const task = this.tasks().find((item) => item.id === id);

    if (!task || this.isDeleting(id)) {
      return;
    }

    this.actionError.set('');
    this.deletingTaskIds.update((ids) => [...ids, id]);

    this.taskService.deleteTask(id).subscribe({
      next: () => {
        this.tasks.update((tasks) => tasks.filter((item) => item.id !== id));

        this.deletingTaskIds.update((ids) => ids.filter((taskId) => taskId !== id));
        this.confirmingDeleteId.set(null);
      },
      error: (error) => {
        console.error('Failed to delete task: ', error);

        this.actionError.set('Unable to delete the task. Please try again.');

        this.deletingTaskIds.update((ids) => ids.filter((taskId) => taskId !== id));
        this.confirmingDeleteId.set(null);
      },
    });
  }

  setFilter(filter: TaskFilter): void {
    this.activeFilter.set(filter);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  dismissError(): void {
    this.actionError.set('');
  }
}
