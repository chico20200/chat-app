import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guards';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.page').then((m) => m.ForgotPasswordPage),
  },

  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },

  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
  },

   {
    path: 'rooms',
    canActivate: [authGuard],
    loadComponent: () => import('./features/rooms/rooms-list/rooms-list.page').then((m) => m.RoomsListPage),
  },
  {
    path: 'rooms/new',
    canActivate: [authGuard],
    loadComponent: () => import('./features/rooms/room-create/room-create.page').then((m) => m.RoomCreatePage),
  },
  {
    path: 'rooms/direct',
    canActivate: [authGuard],
    loadComponent: () => import('./features/rooms/direct-new/direct-new.page').then((m) => m.DirectNewPage),
  },
  {
    path: 'rooms/:roomId/info',
    canActivate: [authGuard],
    loadComponent: () => import('./features/rooms/room-detail/room-detail.page').then((m) => m.RoomDetailPage),
  },
  {
    path: 'rooms/:roomId',
    canActivate: [authGuard],
    loadComponent: () => import('./features/chat/chat.page').then((m) => m.ChatPage),
  },
  { path: '**', redirectTo: 'home' },
];
