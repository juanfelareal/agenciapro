import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Landing from './pages/Landing';
import SelectOrganization from './pages/SelectOrganization';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Projects from './pages/Projects';
import ProjectBoard from './pages/ProjectBoard';
import Tasks from './pages/Tasks';
import Team from './pages/Team';
import Invoices from './pages/Invoices';
import Expenses from './pages/Expenses';
import Comisiones from './pages/Comisiones';
import Inbox from './pages/Inbox';
import Calendar from './pages/Calendar';
import Automations from './pages/Automations';
import Reports from './pages/Reports';
import Notes from './pages/Notes';
import MetricsDashboard from './pages/MetricsDashboard';
import ClientMetrics from './pages/ClientMetrics';
import ClientPlatformSettings from './pages/ClientPlatformSettings';
import SOPs from './pages/SOPs';
import ProjectTemplates from './pages/ProjectTemplates';
import Timesheet from './pages/Timesheet';
import TimeReports from './pages/TimeReports';
import SiigoSettings from './pages/SiigoSettings';
import SiigoCustomers from './pages/SiigoCustomers';
import SiigoInvoices from './pages/SiigoInvoices';

// Portal imports
import PortalLayout from './components/portal/PortalLayout';
import PortalProtectedRoute from './components/portal/PortalProtectedRoute';
import PortalLogin from './pages/portal/PortalLogin';
import PortalDashboard from './pages/portal/PortalDashboard';
import PortalProjects from './pages/portal/PortalProjects';
import PortalProjectDetail from './pages/portal/PortalProjectDetail';
import PortalTasks from './pages/portal/PortalTasks';
import PortalTaskDetail from './pages/portal/PortalTaskDetail';
import PortalInvoices from './pages/portal/PortalInvoices';
import PortalMetrics from './pages/portal/PortalMetrics';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page - public homepage */}
        <Route path="/" element={<Landing />} />

        {/* Login page - no layout */}
        <Route path="/login" element={<Login />} />

        {/* Organization selector - no layout */}
        <Route path="/select-org" element={<SelectOrganization />} />

        {/* Register page - no layout */}
        <Route path="/register" element={<Register />} />

        {/* Landing page - no layout */}
        <Route path="/landing" element={<Landing />} />


        {/* Portal Login - no layout */}
        <Route path="/portal/login" element={<PortalLogin />} />

        {/* Portal routes with PortalLayout */}
        <Route path="/portal" element={<PortalLayout />}>
          <Route
            index
            element={
              <PortalProtectedRoute>
                <PortalDashboard />
              </PortalProtectedRoute>
            }
          />
          <Route
            path="projects"
            element={
              <PortalProtectedRoute permission="can_view_projects">
                <PortalProjects />
              </PortalProtectedRoute>
            }
          />
          <Route
            path="projects/:id"
            element={
              <PortalProtectedRoute permission="can_view_projects">
                <PortalProjectDetail />
              </PortalProtectedRoute>
            }
          />
          <Route
            path="tasks"
            element={
              <PortalProtectedRoute permission="can_view_tasks">
                <PortalTasks />
              </PortalProtectedRoute>
            }
          />
          <Route
            path="tasks/:id"
            element={
              <PortalProtectedRoute permission="can_view_tasks">
                <PortalTaskDetail />
              </PortalProtectedRoute>
            }
          />
          <Route
            path="invoices"
            element={
              <PortalProtectedRoute permission="can_view_invoices">
                <PortalInvoices />
              </PortalProtectedRoute>
            }
          />
          <Route
            path="metrics"
            element={
              <PortalProtectedRoute permission="can_view_metrics">
                <PortalMetrics />
              </PortalProtectedRoute>
            }
          />
        </Route>

        {/* App routes with Layout */}
        <Route
          path="/app/*"
          element={
            <Layout>
              <Routes>
                <Route
                  index
                  element={
                    <ProtectedRoute permission="dashboard">
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="clients"
                  element={
                    <ProtectedRoute permission="clients">
                      <Clients />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="projects"
                  element={
                    <ProtectedRoute permission="projects">
                      <Projects />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="projects/:id"
                  element={
                    <ProtectedRoute permission="projects">
                      <ProjectBoard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="tasks"
                  element={
                    <ProtectedRoute permission="tasks">
                      <Tasks />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="team"
                  element={
                    <ProtectedRoute permission="team">
                      <Team />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="invoices"
                  element={
                    <ProtectedRoute permission="invoices">
                      <Invoices />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="expenses"
                  element={
                    <ProtectedRoute permission="expenses">
                      <Expenses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="comisiones"
                  element={
                    <ProtectedRoute permission="comisiones">
                      <Comisiones />
                    </ProtectedRoute>
                  }
                />
                <Route path="inbox" element={<Inbox />} />
                <Route
                  path="calendario"
                  element={
                    <ProtectedRoute permission="calendario">
                      <Calendar />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="automatizaciones"
                  element={
                    <ProtectedRoute permission="automatizaciones">
                      <Automations />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="reportes"
                  element={
                    <ProtectedRoute permission="reportes">
                      <Reports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="notas"
                  element={
                    <ProtectedRoute permission="notas">
                      <Notes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="metricas"
                  element={
                    <ProtectedRoute permission="metricas">
                      <MetricsDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="metricas/cliente/:clientId"
                  element={
                    <ProtectedRoute permission="metricas">
                      <ClientMetrics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="clients/:id/plataformas"
                  element={
                    <ProtectedRoute permission="clients">
                      <ClientPlatformSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="sops"
                  element={
                    <ProtectedRoute permission="sops">
                      <SOPs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="plantillas-proyecto"
                  element={
                    <ProtectedRoute permission="plantillas">
                      <ProjectTemplates />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="timesheet"
                  element={
                    <ProtectedRoute permission="timesheet">
                      <Timesheet />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="time-reports"
                  element={
                    <ProtectedRoute permission="time_reports">
                      <TimeReports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="siigo"
                  element={
                    <ProtectedRoute permission="siigo">
                      <SiigoSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="siigo/customers"
                  element={
                    <ProtectedRoute permission="siigo">
                      <SiigoCustomers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="siigo/invoices"
                  element={
                    <ProtectedRoute permission="siigo">
                      <SiigoInvoices />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
