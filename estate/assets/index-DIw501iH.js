 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var l$1=Symbol.for("react.element"),n$1=Symbol.for("react.portal"),p$2=Symbol.for("react.fragment"),q$1=Symbol.for("react.strict_mode"),r=Symbol.for("react.profiler"),t=Symbol.for("react.provider"),u=Symbol.for("react.context"),v$1=Symbol.for("react.forward_ref"),w=Symbol.for("react.suspense"),x=Symbol.for("react.memo"),y=Symbol.for("react.lazy"),z$1=Symbol.iterator;function A$1(e){return e===null||typeof e!="object"?null:(e=z$1&&e[z$1]||e["@@iterator"],typeof e=="function"?e:null)}var B$1={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},C$1=Object.assign,D$1={};function E$1(e,s,i){this.props=e,this.context=s,this.refs=D$1,this.updater=i||B$1}E$1.prototype.isReactComponent={};E$1.prototype.setState=function(e,s){if(typeof e!="object"&&typeof e!="function"&&e!=null)throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,e,s,"setState")};E$1.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")};function F(){}F.prototype=E$1.prototype;function G$1(e,s,i){this.props=e,this.context=s,this.refs=D$1,this.updater=i||B$1}var H$1=G$1.prototype=new F;H$1.constructor=G$1;C$1(H$1,E$1.prototype);H$1.isPureReactComponent=!0;var I$1=Array.isArray,J=Object.prototype.hasOwnProperty,K$1={current:null},L$1={key:!0,ref:!0,__self:!0,__source:!0};function M$1(e,s,i){var o,a={},c=null,d=null;if(s!=null)for(o in s.ref!==void 0&&(d=s.ref),s.key!==void 0&&(c=""+s.key),s)J.call(s,o)&&!L$1.hasOwnProperty(o)&&(a[o]=s[o]);var g=arguments.length-2;if(g===1)a.children=i;else if(1<g){for(var h=Array(g),_=0;_<g;_++)h[_]=arguments[_+2];a.children=h}if(e&&e.defaultProps)for(o in g=e.defaultProps,g)a[o]===void 0&&(a[o]=g[o]);return{$$typeof:l$1,type:e,key:c,ref:d,props:a,_owner:K$1.current}}function N$1(e,s){return{$$typeof:l$1,type:e.type,key:s,ref:e.ref,props:e.props,_owner:e._owner}}function O$1(e){return typeof e=="object"&&e!==null&&e.$$typeof===l$1}function escape$1(e){var s={"=":"=0",":":"=2"};return"$"+e.replace(/[=:]/g,function(i){return s[i]})}var P$1=/\/+/g;function Q$1(e,s){return typeof e=="object"&&e!==null&&e.key!=null?escape$1(""+e.key):s.toString(36)}function R$1(e,s,i,o,a){var c=typeof e;(c==="undefined"||c==="boolean")&&(e=null);var d=!1;if(e===null)d=!0;else switch(c){case"string":case"number":d=!0;break;case"object":switch(e.$$typeof){case l$1:case n$1:d=!0}}if(d)return d=e,a=a(d),e=o===""?"."+Q$1(d,0):o,I$1(a)?(i="",e!=null&&(i=e.replace(P$1,"$&/")+"/"),R$1(a,s,i,"",function(_){return _})):a!=null&&(O$1(a)&&(a=N$1(a,i+(!a.key||d&&d.key===a.key?"":(""+a.key).replace(P$1,"$&/")+"/")+e)),s.push(a)),1;if(d=0,o=o===""?".":o+":",I$1(e))for(var g=0;g<e.length;g++){c=e[g];var h=o+Q$1(c,g);d+=R$1(c,s,i,h,a)}else if(h=A$1(e),typeof h=="function")for(e=h.call(e),g=0;!(c=e.next()).done;)c=c.value,h=o+Q$1(c,g++),d+=R$1(c,s,i,h,a);else if(c==="object")throw s=String(e),Error("Objects are not valid as a React child (found: "+(s==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":s)+"). If you meant to render a collection of children, use an array instead.");return d}function S$1(e,s,i){if(e==null)return e;var o=[],a=0;return R$1(e,o,"","",function(c){return s.call(i,c,a++)}),o}function T$1(e){if(e._status===-1){var s=e._result;s=s(),s.then(function(i){(e._status===0||e._status===-1)&&(e._status=1,e._result=i)},function(i){(e._status===0||e._status===-1)&&(e._status=2,e._result=i)}),e._status===-1&&(e._status=0,e._result=s)}if(e._status===1)return e._result.default;throw e._result}var U$1={current:null},V$1={transition:null},W$1={ReactCurrentDispatcher:U$1,ReactCurrentBatchConfig:V$1,ReactCurrentOwner:K$1};function X$2(){throw Error("act(...) is not supported in production builds of React.")}react_production_min.Children={map:S$1,forEach:function(e,s,i){S$1(e,function(){s.apply(this,arguments)},i)},count:function(e){var s=0;return S$1(e,function(){s++}),s},toArray:function(e){return S$1(e,function(s){return s})||[]},only:function(e){if(!O$1(e))throw Error("React.Children.only expected to receive a single React element child.");return e}};react_production_min.Component=E$1;react_production_min.Fragment=p$2;react_production_min.Profiler=r;react_production_min.PureComponent=G$1;react_production_min.StrictMode=q$1;react_production_min.Suspense=w;react_production_min.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=W$1;react_production_min.act=X$2;react_production_min.cloneElement=function(e,s,i){if(e==null)throw Error("React.cloneElement(...): The argument must be a React element, but you passed "+e+".");var o=C$1({},e.props),a=e.key,c=e.ref,d=e._owner;if(s!=null){if(s.ref!==void 0&&(c=s.ref,d=K$1.current),s.key!==void 0&&(a=""+s.key),e.type&&e.type.defaultProps)var g=e.type.defaultProps;for(h in s)J.call(s,h)&&!L$1.hasOwnProperty(h)&&(o[h]=s[h]===void 0&&g!==void 0?g[h]:s[h])}var h=arguments.length-2;if(h===1)o.children=i;else if(1<h){g=Array(h);for(var _=0;_<h;_++)g[_]=arguments[_+2];o.children=g}return{$$typeof:l$1,type:e.type,key:a,ref:c,props:o,_owner:d}};react_production_min.createContext=function(e){return e={$$typeof:u,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null,_defaultValue:null,_globalName:null},e.Provider={$$typeof:t,_context:e},e.Consumer=e};react_production_min.createElement=M$1;react_production_min.createFactory=function(e){var s=M$1.bind(null,e);return s.type=e,s};react_production_min.createRef=function(){return{current:null}};react_production_min.forwardRef=function(e){return{$$typeof:v$1,render:e}};react_production_min.isValidElement=O$1;react_production_min.lazy=function(e){return{$$typeof:y,_payload:{_status:-1,_result:e},_init:T$1}};react_production_min.memo=function(e,s){return{$$typeof:x,type:e,compare:s===void 0?null:s}};react_production_min.startTransition=function(e){var s=V$1.transition;V$1.transition={};try{e()}finally{V$1.transition=s}};react_production_min.unstable_act=X$2;react_production_min.useCallback=function(e,s){return U$1.current.useCallback(e,s)};react_production_min.useContext=function(e){return U$1.current.useContext(e)};react_production_min.useDebugValue=function(){};react_production_min.useDeferredValue=function(e){return U$1.current.useDeferredValue(e)};react_production_min.useEffect=function(e,s){return U$1.current.useEffect(e,s)};react_production_min.useId=function(){return U$1.current.useId()};react_production_min.useImperativeHandle=function(e,s,i){return U$1.current.useImperativeHandle(e,s,i)};react_production_min.useInsertionEffect=function(e,s){return U$1.current.useInsertionEffect(e,s)};react_production_min.useLayoutEffect=function(e,s){return U$1.current.useLayoutEffect(e,s)};react_production_min.useMemo=function(e,s){return U$1.current.useMemo(e,s)};react_production_min.useReducer=function(e,s,i){return U$1.current.useReducer(e,s,i)};react_production_min.useRef=function(e){return U$1.current.useRef(e)};react_production_min.useState=function(e){return U$1.current.useState(e)};react_production_min.useSyncExternalStore=function(e,s,i){return U$1.current.useSyncExternalStore(e,s,i)};react_production_min.useTransition=function(){return U$1.current.useTransition()};react_production_min.version="18.3.1";react.exports=react_production_min;var reactExports=react.exports;const React=getDefaultExportFromCjs(reactExports);/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var f=reactExports,k=Symbol.for("react.element"),l=Symbol.for("react.fragment"),m$1=Object.prototype.hasOwnProperty,n=f.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,p$1={key:!0,ref:!0,__self:!0,__source:!0};function q(e,s,i){var o,a={},c=null,d=null;i!==void 0&&(c=""+i),s.key!==void 0&&(c=""+s.key),s.ref!==void 0&&(d=s.ref);for(o in s)m$1.call(s,o)&&!p$1.hasOwnProperty(o)&&(a[o]=s[o]);if(e&&e.defaultProps)for(o in s=e.defaultProps,s)a[o]===void 0&&(a[o]=s[o]);return{$$typeof:k,type:e,key:c,ref:d,props:a,_owner:n.current}}reactJsxRuntime_production_min.Fragment=l;reactJsxRuntime_production_min.jsx=q;reactJsxRuntime_production_min.jsxs=q;jsxRuntime.exports=reactJsxRuntime_production_min;var jsxRuntimeExports=jsxRuntime.exports,client={},reactDom={exports:{}},reactDom_production_min={},scheduler$1={exports:{}},scheduler_production_min={};/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var aa=reactExports,ca=schedulerExports;function p(e){for(var s="https://reactjs.org/docs/error-decoder.html?invariant="+e,i=1;i<arguments.length;i++)s+="&args[]="+encodeURIComponent(arguments[i]);return"Minified React error #"+e+"; visit "+s+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}var da=new Set,ea={};function fa(e,s){ha(e,s),ha(e+"Capture",s)}function ha(e,s){for(ea[e]=s,e=0;e<s.length;e++)da.add(s[e])}var ia=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),ja=Object.prototype.hasOwnProperty,ka=/^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,la={},ma={};function oa(e){return ja.call(ma,e)?!0:ja.call(la,e)?!1:ka.test(e)?ma[e]=!0:(la[e]=!0,!1)}function pa(e,s,i,o){if(i!==null&&i.type===0)return!1;switch(typeof s){case"function":case"symbol":return!0;case"boolean":return o?!1:i!==null?!i.acceptsBooleans:(e=e.toLowerCase().slice(0,5),e!=="data-"&&e!=="aria-");default:return!1}}function qa(e,s,i,o){if(s===null||typeof s>"u"||pa(e,s,i,o))return!0;if(o)return!1;if(i!==null)switch(i.type){case 3:return!s;case 4:return s===!1;case 5:return isNaN(s);case 6:return isNaN(s)||1>s}return!1}function v(e,s,i,o,a,c,d){this.acceptsBooleans=s===2||s===3||s===4,this.attributeName=o,this.attributeNamespace=a,this.mustUseProperty=i,this.propertyName=e,this.type=s,this.sanitizeURL=c,this.removeEmptyString=d}var z={};"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(e){z[e]=new v(e,0,!1,e,null,!1,!1)});[["acceptCharset","accept-charset"],["className","class"],["htmlFor","for"],["httpEquiv","http-equiv"]].forEach(function(e){var s=e[0];z[s]=new v(s,1,!1,e[1],null,!1,!1)});["contentEditable","draggable","spellCheck","value"].forEach(function(e){z[e]=new v(e,2,!1,e.toLowerCase(),null,!1,!1)});["autoReverse","externalResourcesRequired","focusable","preserveAlpha"].forEach(function(e){z[e]=new v(e,2,!1,e,null,!1,!1)});"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(e){z[e]=new v(e,3,!1,e.toLowerCase(),null,!1,!1)});["checked","multiple","muted","selected"].forEach(function(e){z[e]=new v(e,3,!0,e,null,!1,!1)});["capture","download"].forEach(function(e){z[e]=new v(e,4,!1,e,null,!1,!1)});["cols","rows","size","span"].forEach(function(e){z[e]=new v(e,6,!1,e,null,!1,!1)});["rowSpan","start"].forEach(function(e){z[e]=new v(e,5,!1,e.toLowerCase(),null,!1,!1)});var ra=/[\-:]([a-z])/g;function sa(e){return e[1].toUpperCase()}"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(e){var s=e.replace(ra,sa);z[s]=new v(s,1,!1,e,null,!1,!1)});"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(e){var s=e.replace(ra,sa);z[s]=new v(s,1,!1,e,"http://www.w3.org/1999/xlink",!1,!1)});["xml:base","xml:lang","xml:space"].forEach(function(e){var s=e.replace(ra,sa);z[s]=new v(s,1,!1,e,"http://www.w3.org/XML/1998/namespace",!1,!1)});["tabIndex","crossOrigin"].forEach(function(e){z[e]=new v(e,1,!1,e.toLowerCase(),null,!1,!1)});z.xlinkHref=new v("xlinkHref",1,!1,"xlink:href","http://www.w3.org/1999/xlink",!0,!1);["src","href","action","formAction"].forEach(function(e){z[e]=new v(e,1,!1,e.toLowerCase(),null,!0,!0)});function ta(e,s,i,o){var a=z.hasOwnProperty(s)?z[s]:null;(a!==null?a.type!==0:o||!(2<s.length)||s[0]!=="o"&&s[0]!=="O"||s[1]!=="n"&&s[1]!=="N")&&(qa(s,i,a,o)&&(i=null),o||a===null?oa(s)&&(i===null?e.removeAttribute(s):e.setAttribute(s,""+i)):a.mustUseProperty?e[a.propertyName]=i===null?a.type===3?!1:"":i:(s=a.attributeName,o=a.attributeNamespace,i===null?e.removeAttribute(s):(a=a.type,i=a===3||a===4&&i===!0?"":""+i,o?e.setAttributeNS(o,s,i):e.setAttribute(s,i))))}var ua=aa.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,va=Symbol.for("react.element"),wa=Symbol.for("react.portal"),ya=Symbol.for("react.fragment"),za=Symbol.for("react.strict_mode"),Aa=Symbol.for("react.profiler"),Ba=Symbol.for("react.provider"),Ca=Symbol.for("react.context"),Da=Symbol.for("react.forward_ref"),Ea=Symbol.for("react.suspense"),Fa=Symbol.for("react.suspense_list"),Ga=Symbol.for("react.memo"),Ha=Symbol.for("react.lazy"),Ia=Symbol.for("react.offscreen"),Ja=Symbol.iterator;function Ka(e){return e===null||typeof e!="object"?null:(e=Ja&&e[Ja]||e["@@iterator"],typeof e=="function"?e:null)}var A=Object.assign,La;function Ma(e){if(La===void 0)try{throw Error()}catch(i){var s=i.stack.trim().match(/\n( *(at )?)/);La=s&&s[1]||""}return`
`+La+e}var Na=!1;function Oa(e,s){if(!e||Na)return"";Na=!0;var i=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{if(s)if(s=function(){throw Error()},Object.defineProperty(s.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(s,[])}catch(_){var o=_}Reflect.construct(e,[],s)}else{try{s.call()}catch(_){o=_}e.call(s.prototype)}else{try{throw Error()}catch(_){o=_}e()}}catch(_){if(_&&o&&typeof _.stack=="string"){for(var a=_.stack.split(`
`),c=o.stack.split(`
`),d=a.length-1,g=c.length-1;1<=d&&0<=g&&a[d]!==c[g];)g--;for(;1<=d&&0<=g;d--,g--)if(a[d]!==c[g]){if(d!==1||g!==1)do if(d--,g--,0>g||a[d]!==c[g]){var h=`
Error generating stack: `+c.message+`
 * react-router v7.9.5
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT

 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const toKebabCase=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),mergeClasses=(...e)=>e.filter((s,i,o)=>!!s&&o.indexOf(s)===i).join(" ");/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var defaultAttributes={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Icon=reactExports.forwardRef(({color:e="currentColor",size:s=24,strokeWidth:i=2,absoluteStrokeWidth:o,className:a="",children:c,iconNode:d,...g},h)=>reactExports.createElement("svg",{ref:h,...defaultAttributes,width:s,height:s,stroke:e,strokeWidth:o?Number(i)*24/Number(s):i,className:mergeClasses("lucide",a),...g},[...d.map(([_,j])=>reactExports.createElement(_,j)),...Array.isArray(c)?c:[c]]));/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const createLucideIcon=(e,s)=>{const i=reactExports.forwardRef(({className:o,...a},c)=>reactExports.createElement(Icon,{ref:c,iconNode:s,className:mergeClasses(`lucide-${toKebabCase(e)}`,o),...a}));return i.displayName=`${e}`,i};/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const BookOpen=createLucideIcon("BookOpen",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]]);/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Calendar$1=createLucideIcon("Calendar",[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]]);/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const DollarSign=createLucideIcon("DollarSign",[["line",{x1:"12",x2:"12",y1:"2",y2:"22",key:"7eqyqh"}],["path",{d:"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",key:"1b0p4s"}]]);/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ellipsis=createLucideIcon("Ellipsis",[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"19",cy:"12",r:"1",key:"1wjl8i"}],["circle",{cx:"5",cy:"12",r:"1",key:"1pcz8c"}]]);/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const FileText=createLucideIcon("FileText",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]]);/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Folder=createLucideIcon("Folder",[["path",{d:"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",key:"1kt360"}]]);/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const House=createLucideIcon("House",[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"1d0kgt"}]]);/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const NotebookPen=createLucideIcon("NotebookPen",[["path",{d:"M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4",key:"re6nr2"}],["path",{d:"M2 6h4",key:"aawbzj"}],["path",{d:"M2 10h4",key:"l0bgd4"}],["path",{d:"M2 14h4",key:"1gsvsf"}],["path",{d:"M2 18h4",key:"1bu2t1"}],["path",{d:"M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",key:"pqwjuv"}]]);/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Settings=createLucideIcon("Settings",[["path",{d:"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",key:"1qme2f"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const SquareCheckBig=createLucideIcon("SquareCheckBig",[["path",{d:"M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5",key:"1uzm8b"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]]);/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const User=createLucideIcon("User",[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]]);/**
 * @license lucide-react v0.452.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
`).filter(d=>d),a=Math.min(...o.map(d=>d.length-d.trimStart().length)),c=o.map(d=>d.slice(a)).map(d=>" ".repeat(this.indent*2)+d);for(const d of c)this.content.push(d)}compile(){const s=Function,i=this==null?void 0:this.args,a=[...((this==null?void 0:this.content)??[""]).map(c=>`  ${c}`)];return new s(...i,a.join(`
        if (${mt}.issues.length) {
          payload.issues = payload.issues.concat(${mt}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${ot}, ...iss.path] : [${ot}]
          })));
        }
        
        
        if (${mt}.value === undefined) {
          if (${ot} in input) {
            newResult[${ot}] = undefined;
          }
        } else {
          newResult[${ot}] = ${mt}.value;
        }
        
import ws from "ws"
new RealtimeClient(url, { transport: ws })`}}}return{type:"unsupported",error:"Unknown JavaScript runtime without WebSocket support.",workaround:"Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation."}}static getWebSocketConstructor(){const s=this.detectEnvironment();if(s.constructor)return s.constructor;let i=s.error||"WebSocket not supported in this environment.";throw s.workaround&&(i+=`

  addEventListener("message", (e) => {
    if (e.data.event === "start") {
      setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
    }
  });`;class RealtimeClient{constructor(s,i){var o;if(this.accessTokenValue=null,this.apiKey=null,this.channels=new Array,this.endPoint="",this.httpEndpoint="",this.headers={},this.params={},this.timeout=DEFAULT_TIMEOUT,this.transport=null,this.heartbeatIntervalMs=CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL,this.heartbeatTimer=void 0,this.pendingHeartbeatRef=null,this.heartbeatCallback=noop,this.ref=0,this.reconnectTimer=null,this.vsn=DEFAULT_VSN,this.logger=noop,this.conn=null,this.sendBuffer=[],this.serializer=new Serializer,this.stateChangeCallbacks={open:[],close:[],error:[],message:[]},this.accessToken=null,this._connectionState="disconnected",this._wasManualDisconnect=!1,this._authPromise=null,this._resolveFetch=a=>a?(...c)=>a(...c):(...c)=>fetch(...c),!(!((o=i==null?void 0:i.params)===null||o===void 0)&&o.apikey))throw new Error("API key is required to connect to Realtime");this.apiKey=i.params.apikey,this.endPoint=`${s}/${TRANSPORTS.websocket}`,this.httpEndpoint=httpEndpointURL(s),this._initializeOptions(i),this._setupReconnectionTimer(),this.fetch=this._resolveFetch(i==null?void 0:i.fetch)}connect(){if(!(this.isConnecting()||this.isDisconnecting()||this.conn!==null&&this.isConnected())){if(this._setConnectionState("connecting"),this.accessToken&&!this._authPromise&&this._setAuthSafely("connect"),this.transport)this.conn=new this.transport(this.endpointURL());else try{this.conn=WebSocketFactory.createWebSocket(this.endpointURL())}catch(s){this._setConnectionState("disconnected");const i=s.message;throw i.includes("Node.js")?new Error(`${i}

To use Realtime in Node.js, you need to provide a WebSocket implementation:

Option 1: Use Node.js 22+ which has native WebSocket support
Option 2: Install and provide the "ws" package:

  npm install ws

  import ws from "ws"
  const client = new RealtimeClient(url, {
    ...options,
    transport: ws
`:"",at=`${et} wants you to sign in with your Ethereum account:
${rt}

Version: ${tt}
Chain ID: ${i}${d?`
Nonce: ${d}`:""}
Issued At: ${c.toISOString()}`;if(a&&(nt+=`
Expiration Time: ${a.toISOString()}`),g&&(nt+=`
Not Before: ${g.toISOString()}`),h&&(nt+=`
Request ID: ${h}`),_){let st=`
Resources:`;for(const lt of _){if(!lt||typeof lt!="string")throw new Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${lt}`);st+=`
- ${lt}`}nt+=st}return`${at}
`)},toCsv=(e,s,i,o,a,c,d,g,h)=>{const _=[];_.push(["Buyout worksheet for",e]),_.push(["Appraised value",formatCurrency(i)]),_.push(["Sister share %",s||"0"]),_.push(["Gross due",formatCurrency(o)]),_.push([]),_.push(["Credits (reduce payment)","Amount"]),a.length===0?_.push(["None",formatCurrency(0)]):a.forEach(_e=>{!_e.description&&!_e.amount||_.push([_e.description||"Credit",formatCurrency(parseNumericInput(_e.amount))])}),_.push(["Total credits",formatCurrency(c)]),_.push([]),_.push(["Adjustments","Amount"]),d.length===0?_.push(["None",formatCurrency(0)]):d.forEach(_e=>{!_e.description&&!_e.amount||_.push([_e.description||"Adjustment",formatCurrency(parseNumericInput(_e.amount))])}),_.push(["Total adjustments",formatCurrency(g)]),_.push([]),_.push(["Net payment due to sister",formatCurrency(h)]);const j=_e=>{if(_e==null)return"";const tt=/[",\n]/.test(_e),rt=_e.replace(/"/g,'""');return tt?`"${rt}"`:rt};return _.map(_e=>_e.map(tt=>j(String(tt??""))).join(",")).join(`\r
   ${o.detail}`:o.title?`${c} ${o.title}`:`${c} ${o.detail??""}`.trim()}).join(`
`);s.push(i)}return e.notes.length>0&&s.push(e.notes.join(`
`)),e.templates.length>0&&e.templates.forEach(i=>{s.push(`${i.title}
${i.body}`.trim())}),s.map(i=>i.trim()).filter(Boolean).join(`

`);throw new Error(`Invalid plan JSON:
