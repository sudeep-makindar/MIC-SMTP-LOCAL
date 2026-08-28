import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import DialogHost from "./components/DialogHost";
import Dashboard from "./pages/Dashboard";
import CampaignWizard from "./pages/CampaignWizard";
import SendingScreen from "./pages/SendingScreen";
import CampaignDetail from "./pages/CampaignDetail";
import Templates from "./pages/Templates";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/campaigns/:id/wizard" element={<CampaignWizard />} />
        <Route path="/campaigns/:id/send" element={<SendingScreen />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <DialogHost />
    </Layout>
  );
}
