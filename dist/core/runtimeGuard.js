import o from"fs";import s from"path";import{generateRuntimeCode as c}from"../utils/crypto.js";import{PUBLIC_ASSETS_DIR as i,RUNTIME_FILE_PATH as a}from"../utils/constants.js";const t={code:"",expiresAt:0,rotationIntervalMs:5*60*1e3},m=()=>{o.existsSync(i)||o.mkdirSync(i,{recursive:!0})},p=()=>`window.__WG_RUNTIME__ = Object.freeze({
  verificationCode: '${t.code}',
  generatedAt: ${Date.now()},
  expiresAt: ${t.expiresAt},
  rotationIntervalMs: ${t.rotationIntervalMs}
});
`,u=()=>{m(),o.writeFileSync(a,p(),"utf-8")},n=()=>{t.code=c(),t.expiresAt=Date.now()+t.rotationIntervalMs,u()},R=e=>{const r=Math.max(1,e)*60*1e3;t.rotationIntervalMs=r,t.timer&&clearInterval(t.timer),n(),t.timer=setInterval(n,r)},v=()=>t.code,M=e=>{const r=Array.isArray(e)?e[0]:e;return!!r&&r===t.code},f=()=>{n()},A=()=>s.relative(process.cwd(),a),S=()=>({expiresAt:t.expiresAt,rotationIntervalMs:t.rotationIntervalMs});export{f as forceRotateRuntimeCode,v as getRuntimeCode,S as getRuntimeMetadata,A as getRuntimeScriptPath,R as initRuntimeGuard,M as isValidRuntimeCode};
