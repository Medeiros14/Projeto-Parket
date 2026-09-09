import { RouterProvider } from "react-router";
import { router } from "./routes";
// Import early to suppress Motion false-positive warnings before any component renders
import "./hooks/useParallax";

// App entry point
function App() {
  return <RouterProvider router={router} />;
}

export default App;