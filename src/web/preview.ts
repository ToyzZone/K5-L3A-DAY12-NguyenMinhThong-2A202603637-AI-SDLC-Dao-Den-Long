import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { x } from './themes.js';
const c = new OrbitControls(new THREE.PerspectiveCamera(), document.body);
console.log(x, c, THREE.REVISION);
