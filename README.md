# Liang Dao Assessment

# Technical Proof –  3D Scene

## Overview

This repository contains a technical proof developed as part of a coding challenge.  
The goal of the project is to demonstrate my approach to architecture and proptech, typing, and interactive 3D rendering using modern frontend tooling like R3F.

The implementation focuses on clarity, scalability, and maintainability rather than feature completeness.

## Author

- David Mayorga-Herrera - [Website](https://mayinteractive.io/)

---

### Built with

- Vite + React 19 + Typescript
- pnpm as package-manager
- react-three/fiber (R3F) 
- Three.js

### Prerequiremnts

** Project setup **

- > pmpn install 
- > pnpm run dev 

### What I developed

1. MainCanvas from scratch, using Canvas and some default lights from DOM components provided by R3F.
2. Reusable modular component **BuildingElement** to render floors or walls
3. Mock data simulating API requests and rendering customized BuildingElement component.
4. Interactive meshes clickable as being selected
5. React component showing properties and metadata of selected mesh linked to the R3F Canvas
6. Included OrbitControls as extended component from 'three-stdlib'

---

## Still To Do

- Enhance user interaction, i.e. Materials changed for selected and hover 3d components 
- Improve lighting
- Documentation of every component and its properties

---

## What I Would Add With More Time

- TailwindCSS to enhance style of React components
- Basic testing with @react-three/test-renderer
- Ids management with uuid package

---

## Notes
This proof prioritizes functional requirements, clarity, type safety, and extensibility over visual polish.
