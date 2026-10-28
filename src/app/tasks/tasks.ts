import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
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
  private readonly cdr = inject(ChangeDetectorRef);

  tasks: Task[] = [];

  newTaskTitle = '';

  activeFilter: TaskFilter = 'all';

  isLoading = false;

  errorMessage = '';

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.taskService.getTasks().subscribe({
      next: (tasks) => {
        this.tasks = tasks;
        this.isLoading = false;

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Failed to load tasks: ', error);

        this.errorMessage = 'Unable to load tasks. Please check that the API is running.';

        this.isLoading = false;

        this.cdr.detectChanges();
      },
    });
  }

  private nextId = 4;

  get filteredTasks(): Task[] {
    switch (this.activeFilter) {
      case 'pending':
        return this.tasks.filter((task) => !task.isCompleted);

      case 'completed':
        return this.tasks.filter((task) => task.isCompleted);

      default:
        return this.tasks;
    }
  }

  get completedCount(): number {
    return this.tasks.filter((task) => task.isCompleted).length;
  }

  addTask(): void {
    const title = this.newTaskTitle.trim();

    if (!title) {
      return;
    }

    this.tasks = [
      {
        id: this.nextId++,
        title,
        description: '',
        isCompleted: false,
        createdAt: '',
        updatedAt: null,
      },
      ...this.tasks,
    ];

    this.newTaskTitle = '';
    this.activeFilter = 'all';
  }

  toggleTask(id: number): void {
    this.tasks = this.tasks.map((task) =>
      task.id === id ? { ...task, isCompleted: !task.isCompleted } : task,
    );
  }

  deleteTask(id: number): void {
    this.tasks = this.tasks.filter((task) => task.id !== id);
  }

  setFilter(filter: TaskFilter): void {
    this.activeFilter = filter;
  }
}
