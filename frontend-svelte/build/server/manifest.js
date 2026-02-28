const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.JeUqT9EY.js",app:"_app/immutable/entry/app.vp2-nsye.js",imports:["_app/immutable/entry/start.JeUqT9EY.js","_app/immutable/chunks/DVV-lJ1W.js","_app/immutable/chunks/DD-oyJii.js","_app/immutable/chunks/kqMSP_yO.js","_app/immutable/entry/app.vp2-nsye.js","_app/immutable/chunks/DD-oyJii.js","_app/immutable/chunks/BXZ8MstO.js","_app/immutable/chunks/EtgZSITn.js","_app/immutable/chunks/kqMSP_yO.js","_app/immutable/chunks/Ct2Amx5_.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-_A25GE23.js')),
			__memo(() => import('./chunks/1-BNNV9sVK.js')),
			__memo(() => import('./chunks/2-CnwYOrga.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

const prerendered = new Set([]);

const base = "";

export { base, manifest, prerendered };
//# sourceMappingURL=manifest.js.map
