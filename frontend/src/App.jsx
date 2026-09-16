import { lazy } from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  Outlet,
  RouterProvider,
} from "react-router-dom";


import { GlobalProvider } from "./context/GlobalState";
import { ModuleProvider } from "./context/ModuleState";
import { ShortcutProvider } from "./utils/shortcuts/ShortcutProvider";

// User components
import LoginPage from "./Auth/LoginPage";

// Homepage components
import Homepage from "./homepage/pages/Homepage";
import SelectModulePage from "./homepage/pages/SelectModulePage";

import "./App.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ShortcutHelpModal from "./components/ShortcutHelpModal";
import ErrorPage from "./components/ErrorPage";
import ProjectAuthGuard from "./components/ProjectAuthGuard";
import PrivacyTab from "./homepage/components/tabs/PrivacyTab";
import CaveatsTab from "./homepage/components/tabs/CaveatsTab";

// Route pages are lazy-loaded so the login/home bundle stays small
const MyDataPage = lazy(() => import("./homepage/pages/MyDataPage"));

// Shear connection modules
const FinPlate = lazy(() => import("./modules/shearConnection/finPlate/FinPlate"));
const CleatAngle = lazy(() => import("./modules/shearConnection/cleatAngle/CleatAngle"));
const EndPlate = lazy(() => import("./modules/shearConnection/endPlate/EndPlate"));
const SeatedAngle = lazy(() => import("./modules/shearConnection/seatAngle/SeatedAngle"));

// Simple connection modules
const ButtJointWelded = lazy(() => import("./modules/SimpleConnection/ButtJointWelded/ButtJointWelded"));
const ButtJointBolted = lazy(() => import("./modules/SimpleConnection/ButtJointBolted/ButtJointBolted"));
const LapJointWelded = lazy(() => import("./modules/SimpleConnection/LapJointWelded/LapJointWelded"));
const LapJointBolted = lazy(() => import("./modules/SimpleConnection/LapJointBolted/LapJointBolted"));

// Tension members modules
const BoltedToEnd = lazy(() => import("./modules/TensionMembers/BoltedToEnd/BoltedToEnd"));
const WeldedToEnd = lazy(() => import("./modules/TensionMembers/WeldedToEnd/WeldedToEnd"));

// Compression members modules
const CompressionMember = lazy(() => import("./modules/compressionMember/CompressionMember"));
const StrutsBolted = lazy(() => import("./modules/compressionMember/StrutsBolted"));
const StrutsWelded = lazy(() => import("./modules/compressionMember/StrutsWelded"));
const AxiallyLoadedColumn = lazy(() => import("./modules/compressionMember/AxiallyLoadedColumn"));

// Beam modules
const SimplySupportedBeam = lazy(() => import("./modules/flexuralMember/simplySupportedBeam"));
const OnCantilever = lazy(() => import("./modules/flexuralMember/onCantilever"));
const Purlin = lazy(() => import("./modules/flexuralMember/purlin"));
const PlateGirder = lazy(() => import("./modules/flexuralMember/plateGirder"));
const ColumnColumnEndPlate = lazy(() => import("./modules/columnColumnEndPlate/ColumnColumnEndPlate"));
const BeamBeamEndPlate = lazy(() => import("./modules/beamBeamEndPlate/BeamBeamEndPlate"));

// Cover plate modules
const ColumnColumnCoverPlateBolted = lazy(() => import("./modules/columnColumnCoverPlateBolted/CoverPlateBolted"));
const ColumnColumnCoverPlateWelded = lazy(() => import("./modules/columnColumnCoverPlateWelded/CoverPlateWelded"));
const CoverPlateBolted = lazy(() => import("./modules/coverPlateBolted/CoverPlateBolted"));
const CoverPlateWelded = lazy(() => import("./modules/coverPlateWelded/CoverPlateWelded"));
const BasePlate = lazy(() => import("./modules/basePlate/BasePlate"));
const BeamToColumnEndPlate = lazy(() => import("./modules/beamToColumnEndPlate/BeamToColumnEndPlate"));

function App() {
  let loggedIn = false;
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" element={<Root loggedIn={loggedIn} />} errorElement={<ErrorPage />}>
        <Route path="/" element={<LoginPage />} />
        <Route path="/home" element={<Homepage />} />

        {/* Privacy Policy */}
        <Route path="/privacy-policy" element={<PrivacyTab />} />
        <Route path="/caveats" element={<CaveatsTab />} />
        <Route path="/:moduleName" element={<SelectModulePage />} />

        <Route element={<ProjectAuthGuard />}>
          <Route path="/my-data" element={<MyDataPage />} />
          <Route path="/design/:designType/shear/fin_plate/:projectId?" element={<FinPlate />} />
          <Route path="/design/:designType/shear/end_plate/:projectId?" element={<EndPlate />} />
          <Route path="/design/:designType/shear/seatAngle/:projectId?" element={<SeatedAngle />} />
          <Route path="/design/:designType/shear/cleat_angle/:projectId?" element={<CleatAngle />} />
          <Route path="/design/:designType/column-to-column-splice/cover_plate_bolted/:projectId?" element={<ColumnColumnCoverPlateBolted />} />
          <Route path="/design/:designType/column-to-column-splice/cover_plate_welded/:projectId?" element={<ColumnColumnCoverPlateWelded />} />
          <Route path="/design/:designType/column-to-column-splice/end_plate/:projectId?" element={<ColumnColumnEndPlate />} />
          <Route path="/design/:designType/beam-to-beam-splice/cover_plate_bolted/:projectId?" element={<CoverPlateBolted />} />
          <Route path="/design/:designType/beam-to-beam-splice/cover_plate_welded/:projectId?" element={<CoverPlateWelded />} />
          <Route path="/design/:designType/beam-to-beam-splice/end_plate/:projectId?" element={<BeamBeamEndPlate />} />
          <Route path="/design/:designType/base_plate/:projectId?" element={<BasePlate />} />
          <Route path="/design/:designType/simple/butt_joint_welded/:projectId?" element={<ButtJointWelded />} />
          <Route path="/design/:designType/simple/butt_joint_bolted/:projectId?" element={<ButtJointBolted />} />
          <Route path="/design/:designType/simple/lap_joint_welded/:projectId?" element={<LapJointWelded />} />
          <Route path="/design/:designType/simple/lap_joint_bolted/:projectId?" element={<LapJointBolted />} />
          <Route path="/design/:designType/simply_supported_beam/:projectId?" element={<SimplySupportedBeam />} />
          <Route path="/design/:designType/on_cantilever/:projectId?" element={<OnCantilever />} />
          <Route path="/design/:designType/purlin/:projectId?" element={<Purlin />} />
          <Route path="/design/:designType/plate_girder/:projectId?" element={<PlateGirder />} />
          <Route path="/design/:designType/bolted_to_end_gusset/:projectId?" element={<BoltedToEnd />} />
          <Route path="/design/:designType/welded_to_end_gusset/:projectId?" element={<WeldedToEnd />} />
          <Route path="/design/:designType/tension-member/bolted_to_end_gusset/:projectId?" element={<BoltedToEnd />} />
          <Route path="/design/:designType/tension-member/welded_to_end_gusset/:projectId?" element={<WeldedToEnd />} />
          <Route path="/design/:designType/tension_member/bolted_to_end_gusset/:projectId?" element={<BoltedToEnd />} />
          <Route path="/design/:designType/tension_member/welded_to_end_gusset/:projectId?" element={<WeldedToEnd />} />

          <Route path="/design/:designType/column-beam/:projectId?" element={<BeamToColumnEndPlate />} />

          {/* Compression Members */}
          <Route path="/design/:designType/struts_in_trusses/:projectId?" element={<CompressionMember />} />
          <Route path="/design/:designType/struts_bolted_to_end_gusset/:projectId?" element={<StrutsBolted />} />
          <Route path="/design/:designType/struts_welded_to_end_gusset/:projectId?" element={<StrutsWelded />} />
          <Route path="/design/:designType/axially_loaded_column/:projectId?" element={<AxiallyLoadedColumn />} />
        </Route>
      </Route>
    )
  );

  return (
    <GlobalProvider>
      <ModuleProvider>
        <ShortcutProvider>
          <div className="app">
            <ShortcutHelpModal />
            <ToastContainer position="top-right" autoClose={3000} />
            <RouterProvider router={router} />
          </div>
        </ShortcutProvider>
      </ModuleProvider>
    </GlobalProvider>
  );
}

const Root = () => {
  return <Outlet />;
};

export default App;