import * as THREE from 'three';

const EARTH_RADIUS = 50; // Doubled from 25 to 50 for better realism
const ELEVATION_SCALE = 0.2;
const CLOUD_MIN_HEIGHT = 4;  // Increased minimum cloud height
const CLOUD_MAX_HEIGHT = 8;  // Increased maximum cloud height

export class Globe {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.elevationData = null;
        this.EARTH_RADIUS = EARTH_RADIUS;
        this.environmentObjects = new THREE.Group();
        this.clouds = new THREE.Group();
    }

    async initialize() {
        try {
            // Load elevation data
            const response = await fetch('/earth_fib100_with_elevation.json');
            this.elevationData = await response.json();
            
            // Create the globe geometry with more segments for smoother appearance
            const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 128, 64);
            
            // Create material with enhanced earth-like appearance
            const material = new THREE.MeshPhongMaterial({
                color: 0x228B22,  // Slightly brighter green
                shininess: 15,
                flatShading: false, // Smooth shading
                side: THREE.DoubleSide // Render both sides
            });

            // Create the mesh
            this.mesh = new THREE.Mesh(geometry, material);
            
            // Add wireframe for better visibility
            const wireframe = new THREE.WireframeGeometry(geometry);
            const line = new THREE.LineSegments(wireframe);
            line.material.color.setHex(0x000000);
            line.material.opacity = 0.2;
            line.material.transparent = true;
            this.mesh.add(line);
            
            // Apply elevation data to vertices
            this.applyElevationData();
            
            // Add to scene
            this.scene.add(this.mesh);
            
            // Log globe info
            console.log('Globe created with radius:', EARTH_RADIUS);
            console.log('Globe position:', this.mesh.position);
            console.log('Globe geometry vertices:', geometry.attributes.position.count);
            
            return true;
        } catch (error) {
            console.error('Failed to initialize globe:', error);
            return false;
        }
    }

    applyElevationData() {
        if (!this.mesh || !this.elevationData) return;

        const geometry = this.mesh.geometry;
        const vertices = geometry.attributes.position.array;
        let maxElevation = 0;

        // For each vertex
        for (let i = 0; i < vertices.length; i += 3) {
            // Convert vertex position to lat/long
            const vertex = new THREE.Vector3(vertices[i], vertices[i + 1], vertices[i + 2]);
            const latLong = this.cartesianToLatLong(vertex);
            
            // Find closest elevation point
            const elevation = this.getElevationForPoint(latLong.lat, latLong.long);
            maxElevation = Math.max(maxElevation, elevation);
            
            // Apply elevation by moving vertex outward along its normal
            const normal = vertex.normalize();
            const elevationOffset = elevation * ELEVATION_SCALE;
            vertex.multiplyScalar(1 + elevationOffset / EARTH_RADIUS);
            
            // Update vertex position
            vertices[i] = vertex.x;
            vertices[i + 1] = vertex.y;
            vertices[i + 2] = vertex.z;
        }

        console.log('Max elevation applied:', maxElevation);
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
    }

    cartesianToLatLong(point) {
        const normalized = point.normalize();
        const lat = Math.asin(normalized.y) * (180 / Math.PI);
        const long = Math.atan2(normalized.z, normalized.x) * (180 / Math.PI);
        return { lat, long };
    }

    latLongToCartesian(lat, long, radius = EARTH_RADIUS) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (long + 180) * (Math.PI / 180);
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        
        return new THREE.Vector3(x, y, z);
    }

    getElevationForPoint(lat, long) {
        if (!this.elevationData) return 0;

        // Find closest point in elevation data
        let closestPoint = null;
        let minDistance = Infinity;

        for (const point of this.elevationData) {
            const distance = Math.sqrt(
                Math.pow(point.latitude - lat, 2) + 
                Math.pow(point.longitude - long, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        }

        return closestPoint ? closestPoint.elevation / 1000 : 0; // Convert to relative scale
    }

    // Convert world position to lat/long coordinates
    worldToLatLong(position) {
        const localPos = position.clone().sub(this.mesh.position);
        return this.cartesianToLatLong(localPos);
    }

    // Convert lat/long to world position
    latLongToWorld(lat, long) {
        const cartesian = this.latLongToCartesian(lat, long);
        return cartesian.add(this.mesh.position);
    }

    async addEnvironmentObjects() {
        // Clear any existing environment objects
        if (this.environmentObjects) {
            this.scene.remove(this.environmentObjects);
        }
        this.environmentObjects = new THREE.Group();
        this.scene.add(this.environmentObjects);

        // Create tree geometries
        const treeGeometry = new THREE.ConeGeometry(0.4, 2, 8);
        const treeMaterial = new THREE.MeshPhongMaterial({ color: 0x006400 });
        const trunkGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1);
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x4B3621 });

        const treeCount = 200;
        const placedTrees = [];
        const raycaster = new THREE.Raycaster();

        // Helper function to get surface point
        const getSurfacePoint = (lat, long) => {
            const point = this.latLongToWorld(lat, long);
            const elevation = this.getElevationForPoint(lat, long);
            if (elevation === null || elevation < 0 || elevation > 800) return null;
            
            const direction = point.normalize();
            const rayStart = direction.multiplyScalar(this.EARTH_RADIUS * 2);
            raycaster.set(rayStart, direction.negate());
            
            const intersects = raycaster.intersectObject(this.mesh);
            if (intersects.length > 0) {
                return intersects[0].point;
            }
            return null;
        };

        // Sample points using a grid pattern
        const latStep = 180 / Math.sqrt(treeCount * 2);
        const longStep = 360 / Math.sqrt(treeCount * 2);

        for (let lat = -90; lat <= 90; lat += latStep) {
            for (let long = -180; long <= 180; long += longStep) {
                // Add some randomness to the grid
                const sampleLat = lat + (Math.random() - 0.5) * latStep;
                const sampleLong = long + (Math.random() - 0.5) * longStep;
                
                // Get surface point
                const surfacePoint = getSurfacePoint(sampleLat, sampleLong);
                if (!surfacePoint) continue;

                // Check minimum distance from other trees
                let tooClose = false;
                for (const existingTree of placedTrees) {
                    if (surfacePoint.distanceTo(existingTree) < 2) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;

                // Create tree
                const tree = new THREE.Group();
                
                // Add trunk
                const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
                trunk.position.y = 0.5;
                tree.add(trunk);
                
                // Add foliage
                const foliage = new THREE.Mesh(treeGeometry, treeMaterial);
                foliage.position.y = 1.5;
                tree.add(foliage);
                
                // Position tree at surface point
                tree.position.copy(surfacePoint);
                
                // Orient tree along surface normal
                const normal = surfacePoint.clone().normalize();
                const tangent = new THREE.Vector3(1, 0, 0).cross(normal).normalize();
                const bitangent = normal.clone().cross(tangent);
                
                const orientMatrix = new THREE.Matrix4().makeBasis(
                    tangent,
                    normal,
                    bitangent
                );
                tree.setRotationFromMatrix(orientMatrix);
                
                // Scale based on elevation and latitude
                const elevation = this.getElevationForPoint(sampleLat, sampleLong);
                const latitude = Math.abs(sampleLat);
                const latitudeScale = 1 - (latitude / 90) * 0.5;
                const elevationScale = 1 - (elevation / 1000) * 0.3;
                
                // Calculate slope
                const slope = 1 - Math.abs(normal.dot(new THREE.Vector3(0, 1, 0)));
                const slopeScale = 1 - slope * 0.7;
                
                const finalScale = 0.3 * latitudeScale * elevationScale * slopeScale;
                tree.scale.setScalar(finalScale);
                
                this.environmentObjects.add(tree);
                placedTrees.push(surfacePoint);
                
                // Break if we have enough trees
                if (placedTrees.length >= treeCount) {
                    console.log(`Placed ${placedTrees.length} trees`);
                    return;
                }
            }
        }
        
        console.log(`Placed ${placedTrees.length} trees`);
    }

    addClouds() {
        const cloudGeometry = new THREE.SphereGeometry(1, 8, 8); // Doubled cloud size
        const cloudMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6, // Slightly more transparent
            flatShading: true
        });

        // Add cloud clusters
        for (let i = 0; i < 50; i++) {
            const cloudCluster = new THREE.Group();
            
            // Create cluster of 3-7 cloud puffs
            const puffCount = 3 + Math.floor(Math.random() * 5);
            for (let j = 0; j < puffCount; j++) {
                const puff = new THREE.Mesh(cloudGeometry, cloudMaterial);
                
                // Random position within cluster
                puff.position.set(
                    (Math.random() - 0.5) * 4, // Doubled spread
                    (Math.random() - 0.5) * 1,
                    (Math.random() - 0.5) * 4  // Doubled spread
                );
                
                // Random scale for variety
                const scale = 0.8 + Math.random() * 0.4;
                puff.scale.set(scale, scale * 0.6, scale);
                
                cloudCluster.add(puff);
            }

            // Position entire cluster using fibonacci sphere distribution
            const phi = Math.PI * (3 - Math.sqrt(5)) * i;
            const y = 1 - (i / 49) * 2;
            const radius = Math.sqrt(1 - y * y);
            
            const x = Math.cos(phi) * radius;
            const z = Math.sin(phi) * radius;
            
            const basePosition = new THREE.Vector3(x, y, z).normalize();
            const height = CLOUD_MIN_HEIGHT + Math.random() * (CLOUD_MAX_HEIGHT - CLOUD_MIN_HEIGHT);
            const position = basePosition.multiplyScalar(EARTH_RADIUS + height);
            
            cloudCluster.position.copy(position);
            
            // Orient clouds to face slightly upward
            const up = position.clone().normalize();
            const forward = new THREE.Vector3(0, 1, 0);
            const right = forward.clone().cross(up).normalize();
            forward.crossVectors(up, right);
            cloudCluster.quaternion.setFromRotationMatrix(
                new THREE.Matrix4().makeBasis(right, up, forward)
            );
            
            this.clouds.add(cloudCluster);
        }
    }
} 