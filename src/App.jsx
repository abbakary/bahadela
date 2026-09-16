import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DeviceProvider } from "./context/DeviceContext";
import { ToastProvider } from "./components/Toast";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import DeviceSetup from "./pages/DeviceSetup";
import Users from "./pages/Users";
import UserDetail from "./pages/UserDetail";
import Register from "./pages/Register";
import Reports from "./pages/Reports";

export default function App() {
  return (
    <DeviceProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="device" element={<DeviceSetup />} />
              <Route path="users" element={<Users />} />
              <Route path="users/:employeeNo" element={<UserDetail />} />
              <Route path="register" element={<Register />} />
              <Route path="reports" element={<Reports />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </DeviceProvider>
  );
}
