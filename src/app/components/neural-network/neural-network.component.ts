import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';

import * as THREE from 'three';

@Component({
  selector: 'app-neural-network',
  standalone: true,
  templateUrl: './neural-network.component.html',
  styleUrls: ['./neural-network.component.scss'],
})
export class NeuralNetworkComponent implements AfterViewInit {
  @ViewChild('neuralNetworkCanvas', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  ngAfterViewInit(): void {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );

    camera.position.z = 20;

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(renderer.domElement);

    // ---------- NODES ----------

    const nodePositions = [-5, 0, 0, 0, 5, 0, 0, -5, 0, 5, 0, 0];

    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(nodePositions, 3),
    );

    const nodeMaterial = new THREE.PointsMaterial({
      color: 0x00ffff,
      size: 0.5,
    });

    const nodes = new THREE.Points(nodeGeometry, nodeMaterial);

    scene.add(nodes);

    // ---------- CONNECTIONS ----------

    const linePositions = [
      -5, 0, 0, 0, 5, 0, -5, 0, 0, 0, -5, 0, 0, 5, 0, 5, 0, 0, 0, -5, 0, 5, 0,
      0,
    ];

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(linePositions, 3),
    );

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
    });

    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);

    scene.add(lines);

    // ---------- ANIMATION ----------

    function animate() {
      requestAnimationFrame(animate);

      nodes.rotation.y += 0.002;
      lines.rotation.y += 0.002;

      renderer.render(scene, camera);
    }

    animate();

    // ---------- RESIZE ----------

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;

      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }
}
