import { Routes } from "@angular/router";
import { authGuard } from "./guards/auth.guard";

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./views/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./views/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./views/dashboard/home-dashboard/home-dashboard.component').then(
            (m) => m.HomeDashboardComponent,
          ),
      },
      {
        path: 'contacts',
        loadComponent: () =>
          import('./views/dashboard/messages/messages.component').then(
            (m) => m.MessagesComponent,
          ),
      },
      // ── Propuestas Comerciales ──
      {
        path: 'propuestas',
        loadComponent: () =>
          import('./views/dashboard/propuestas/propuestas.component').then(
            (m) => m.PropuestasComponent,
          ),
      },
      {
        path: 'propuestas/nueva',
        loadComponent: () =>
          import('./views/dashboard/propuestas/nueva-propuesta/nueva-propuesta.component').then(
            (m) => m.NuevaPropuestaComponent,
          ),
      },
      {
        path: 'propuestas/:id/editar',
        loadComponent: () =>
          import('./views/dashboard/propuestas/nueva-propuesta/nueva-propuesta.component').then(
            (m) => m.NuevaPropuestaComponent,
          ),
      },
      {
        path: 'propuestas/:id',
        loadComponent: () =>
          import('./views/dashboard/propuestas/detalle-propuesta/detalle-propuesta.component').then(
            (m) => m.DetallePropuestaComponent,
          ),
      },
      // ── Clientes y CRM ──
      {
        path: 'clientes',
        loadComponent: () =>
          import('./views/dashboard/clientes/clientes.component').then(
            (m) => m.ClientesComponent,
          ),
      },
      {
        path: 'clientes/nuevo',
        loadComponent: () =>
          import('./views/dashboard/clientes/clientes.component').then(
            (m) => m.ClientesComponent,
          ),
      },
      {
        path: 'clientes/:id',
        loadComponent: () =>
          import('./views/dashboard/clientes/detalle-cliente/detalle-cliente.component').then(
            (m) => m.DetalleClienteComponent,
          ),
      },
      // ── Proyectos en curso ──
      {
        path: 'proyectos',
        loadComponent: () =>
          import('./views/dashboard/proyectos/proyectos.component').then(
            (m) => m.ProyectosComponent,
          ),
      },
      // ── Finanzas, Cobranzas y Reseñas ──
      {
        path: 'finanzas',
        loadComponent: () =>
          import('./views/dashboard/finanzas/finanzas.component').then(
            (m) => m.FinanzasComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
