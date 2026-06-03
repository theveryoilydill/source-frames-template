import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { createHashRouter, UNSAFE_createClientRoutes, UNSAFE_FrameworkContext } from "react-router";
import { RouterProvider } from "react-router/dom";

declare global {
	interface Window {
		__reactRouterContext: any;
		__reactRouterDataRouter?: unknown;
		__reactRouterManifest: any;
		__reactRouterRouteModules: any;
	}
}

const context = window.__reactRouterContext;
const manifest = window.__reactRouterManifest;
const routeModules = window.__reactRouterRouteModules;

const routes = UNSAFE_createClientRoutes(
	manifest.routes,
	routeModules,
	context.state,
	context.ssr,
	context.isSpaMode,
);

const router = createHashRouter(routes, {
	basename: context.basename,
	hydrationData: context.state,
	future: {
		v8_passThroughRequests: context.future.v8_passThroughRequests,
	},
});

window.__reactRouterDataRouter = router;

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<UNSAFE_FrameworkContext.Provider
				value={{
					manifest,
					routeModules,
					future: context.future,
					ssr: context.ssr,
					isSpaMode: context.isSpaMode,
					routeDiscovery: context.routeDiscovery,
				}}
			>
				<RouterProvider router={router} />
			</UNSAFE_FrameworkContext.Provider>
		</StrictMode>,
	);
});
