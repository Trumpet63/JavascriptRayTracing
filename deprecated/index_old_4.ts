let xSlider = <HTMLInputElement> document.getElementById("xInput");
xSlider.addEventListener("input", () => {circles[0].center[0] = parseFloat(xSlider.value)});
let ySlider = <HTMLInputElement> document.getElementById("yInput");
ySlider.addEventListener("input", () => {circles[0].center[1] = parseFloat(ySlider.value)});
let zSlider = <HTMLInputElement> document.getElementById("zInput");
zSlider.addEventListener("input", () => {circles[0].center[2] = parseFloat(zSlider.value)});

let fpsCounter = <HTMLDivElement> document.getElementById("fpsCounter");
let previousTimeMillis: number;

let width = 1000;
let height = 600;

let canvas = <HTMLCanvasElement> document.getElementById("mainCanvas");
canvas.width = width;
canvas.height = height;
let ctx = canvas.getContext("2d");

// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas
let imageData = ctx.createImageData(width, height);

let yOne = height / width;
let x1: Vector3 = [0, yOne, 0];
let x2: Vector3 = [1, yOne, 0];
let x3: Vector3 = [0, 0, 0];
let x4: Vector3 = [1, 0, 0];
let camera: Vector3 = [0.5, yOne/2, -1];

interface Circle {
    index: number;
    ambient: {r: number, g: number, b: number};
    diffuse: number;
    specular: number;
    shine: number;
    center: Vector3;
    radius: number;
}
let circles: Circle[] = [
    {index: 0, ambient: {r: 1, g: 0, b: 0}, diffuse: 0.7, specular: 0.5, shine: 15, center: <Vector3> [0.5, yOne/2, 1.9], radius: 0.5},
    {index: 1, ambient: {r: 0, g: 1, b: 0}, diffuse: 0.7, specular: 0.5, shine: 15, center: <Vector3> [0.1, 0.8, 1.6], radius: 0.3},
    {index: 2, ambient: {r: 0, g: 0, b: 1}, diffuse: 0.7, specular: 0.5, shine: 15, center: <Vector3> [0.9, 0, 1.8], radius: 0.1},
];
ySlider.value = circles[0].center[1].toString();

let lights = [
    {center: <Vector3> [6, 2, 1], diffuse: {r: 0.5, g: 0.5, b: 0.5}, specular: {r: 0.5, g: 0.5, b: 0.5}},
    {center: <Vector3> [-2, 2, 0], diffuse: {r: 0.2, g: 0.2, b: 0.2}, specular: {r: 0.2, g: 0.2, b: 0.2}},
]

let ambientLight = {r: 0.2, g: 0.2, b: 0.2};

interface Vector {
    x: number;
    y: number;
    z: number;
}

type Vector3 = [number, number, number];

function scaleInPlace3(dest: Vector3, vector: Vector3, scalar: number) {
    dest[0] = scalar * vector[0];
    dest[1] = scalar * vector[1];
    dest[2] = scalar * vector[2];
}

function addInPlace3(dest: Vector3, v1: Vector3, v2: Vector3): void {
    dest[0] = v1[0] + v2[0];
    dest[1] = v1[1] + v2[1];
    dest[2] = v1[2] + v2[2];
}

function subtractInPlace3(dest: Vector3, v1: Vector3, v2: Vector3): void {
    dest[0] = v1[0] - v2[0];
    dest[1] = v1[1] - v2[1];
    dest[2] = v1[2] - v2[2];
}

function product3(v1: Vector3, v2: Vector3): number {
    return v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];
}

function normalizeInPlace(v: Vector3): void {
    let scalar = 1 / Math.sqrt(product3(v, v));
    v[0] *= scalar
    v[1] *= scalar
    v[2] *= scalar
}

let intersect3Temp: Vector3 = [0, 0, 0];
function intersect3(point: Vector3, direction: Vector3, circle: {center: Vector3, radius: number}) {
    let center = circle.center;
    let r = circle.radius;
    let d = direction
    let o = point;
    
    // compute quadratic coefficients
    intersect3Temp[0] = o[0] - center[0];
    intersect3Temp[1] = o[1] - center[1];
    intersect3Temp[2] = o[2] - center[2];
    let a = product3(d, d);
    let b = 2 * product3(intersect3Temp, d);
    let c = product3(intersect3Temp, intersect3Temp) - r * r;

    // temp[i] = o[i] - center[i]
    // a = d[0]*d[0] + d[1]*d[1] + d[2]*d[2]
    // b = 2 * ( temp[0]*d[0] + temp[1]*d[1] + temp[1]*d[1])
    // c = temp[0]*temp[0] + temp[1]*temp[1] + temp[2]*temp[2] - r*r

    let discriminant = b*b - 4*a*c;
    if (discriminant < 0) {
        return undefined;
    }
    let toAdd = Math.sqrt(discriminant);
    let t1 = (-b - toAdd) / (2 * a);
    let t2 = (-b + toAdd) / (2 * a); // we know t2 is greater than t1
    let t = t1 < 1 ? t2 : t1;
    return t;
}

function roundToNPlaces(x: number, numPlaces: number): number {
    let scale: number = Math.pow(10, numPlaces);
    return Math.round(x * scale) / scale;
}

interface Ray {
    pixel: {i: number, j: number};
    direction: Vector3;
}
let rays: Ray[] = [];
let numPixels = width * height;
for (let i = 0; i < numPixels; i++) {
    rays.push({pixel: {i: -1, j: -1}, direction: [0, 0, 0]});
}

interface Intersection {
    circle: Circle;
    t: number;
}
let intersections: {ray: Ray, closestIntersection: Intersection}[] = [];
let numIntersections = 0;
for (let i = 0; i < numPixels; i++) {
    intersections.push({ray: rays[0], closestIntersection: {circle: circles[0], t: 0}});
}

let block1Time: string;
let block2Time: string;
let block3Time: string;

let normal: Vector3 = [0, 0, 0];
let pointOfIntersection: Vector3 = [0, 0, 0];
let lightDirection: Vector3 = [0, 0, 0];
let shadowDirection: Vector3 = [0, 0, 0];
let reflection: Vector3 = [0, 0, 0];
let viewDirection: Vector3 = [0, 0, 0];

window.requestAnimationFrame(draw);
function draw(currentTimeMillis: number) {
    let fps = 1000 / (currentTimeMillis - previousTimeMillis);
    if (!isNaN(fps)) {
        fpsCounter.innerText = "FPS: " + roundToNPlaces(fps, 2);
    }

    // fill all pixels with black
    for (let i = 0; i < width*height; i++) {
        imageData.data[4*i] = 0;
        imageData.data[4*i+1] = 0;
        imageData.data[4*i+2] = 0;
        imageData.data[4*i+3] = 255;
    }

    let prevTime = performance.now();
    let tempTime = 0;

    let hIncrement = 1 / width;
    let vIncrement = 1 / height;
    let horizontal = hIncrement/2;
    for (let i = 0; i < width; i++) {
        let vertical = vIncrement/2;
        for (let j = 0; j < height; j++) {
            // t1[0] = (1-horizontal) * x1[0] + horizontal * x2[0]
            // t2[0] = (1-horizontal) * x3[0] + horizontal * x4[0]
            // p[0] = (1-vertical) * t1[0] + vertical * t2[0]
            // direction[0] = p[0] - camera[0]

            let rayIndex = i * height + j;
            rays[rayIndex].pixel.i = i;
            rays[rayIndex].pixel.j = j;
            rays[rayIndex].direction[0] = (1-vertical) * ( (1-horizontal) * x1[0] + horizontal * x2[0] ) + vertical * ( (1-horizontal) * x3[0] + horizontal * x4[0] ) - camera[0];
            rays[rayIndex].direction[1] = (1-vertical) * ( (1-horizontal) * x1[1] + horizontal * x2[1] ) + vertical * ( (1-horizontal) * x3[1] + horizontal * x4[1] ) - camera[1];
            rays[rayIndex].direction[2] = (1-vertical) * ( (1-horizontal) * x1[2] ) + vertical * ( (1-horizontal) * x3[2] + horizontal * x4[2] ) - camera[2];
            vertical += vIncrement;
        }
        horizontal += hIncrement;
    }
    tempTime = performance.now();
    block1Time = roundToNPlaces(tempTime - prevTime, 3).toString();
    prevTime = tempTime;

    numIntersections = 0;
    for (let k = 0; k < rays.length; k++) {
        let closestIntersection;
        let d = rays[k].direction;
        for (let n = 0; n < circles.length; n++) {
            let circle = circles[n];
            let t = intersect3(camera, d, circle);

            if (t === undefined || t < 1) {
                continue; // the intersection occured between the camera and the view plane
            }

            let intersection = {circle: circle, t: t};
            if (closestIntersection === undefined
                || closestIntersection.t > intersection.t
            ) {
                closestIntersection = intersection;
            }
        }
        if (closestIntersection !== undefined) {
            intersections[numIntersections].ray = rays[k]
            intersections[numIntersections].closestIntersection = closestIntersection;
            numIntersections++;
        }
    }
    tempTime = performance.now();
    block2Time = roundToNPlaces(tempTime - prevTime, 3).toString();
    prevTime = tempTime;

    for (let k = 0; k < numIntersections; k++) {
        let i = intersections[k].ray.pixel.i;
        let j = intersections[k].ray.pixel.j;
        let closest = intersections[k].closestIntersection;
        let circle = closest.circle;
        let rayDirection = intersections[k].ray.direction;

        scaleInPlace3(pointOfIntersection, rayDirection, closest.t);
        addInPlace3(pointOfIntersection, camera, pointOfIntersection);

        subtractInPlace3(normal, pointOfIntersection, circle.center);
        normalizeInPlace(normal);

        let rAmbient = circle.ambient.r * ambientLight.r;
        let gAmbient = circle.ambient.g * ambientLight.g;
        let bAmbient = circle.ambient.b * ambientLight.b;

        let rDiffuse = 0;
        let gDiffuse = 0;
        let bDiffuse = 0;
        let rSpecular = 0;
        let gSpecular = 0;
        let bSpecular = 0;
        for (let n = 0; n < lights.length; n++) {
            let light = lights[n];
            let lightCenter = light.center;

            subtractInPlace3(lightDirection, lightCenter, pointOfIntersection);
            normalizeInPlace(lightDirection);

            let normalDot = product3(normal, lightDirection);
            let shadowed = false;
            if (normalDot > 0) {
                // Check if there's anything blocking the path to the light source
                for (let m = 0; m < circles.length; m++) {
                    if (circles[m].index === circle.index) {
                        continue; // don't check intersection with the current circle
                    }
                    subtractInPlace3(shadowDirection, lightCenter, pointOfIntersection);
                    let shadowT = intersect3(pointOfIntersection, shadowDirection, circles[m]);
                    if (shadowT !== undefined && shadowT > 0) {
                        shadowed = true;
                        break;
                    }
                }

                if (!shadowed) {
                    rDiffuse += normalDot * circle.diffuse * light.diffuse.r;
                    gDiffuse += normalDot * circle.diffuse * light.diffuse.g;
                    bDiffuse += normalDot * circle.diffuse * light.diffuse.b;
                }
            }

            scaleInPlace3(reflection, normal, 2*normalDot)
            subtractInPlace3(reflection, reflection, lightDirection);

            subtractInPlace3(viewDirection, camera, pointOfIntersection);
            normalizeInPlace(viewDirection);

            let reflectionDot = product3(viewDirection, reflection);
            if (reflectionDot > 0 && !shadowed) {
                rSpecular += Math.pow(reflectionDot, circle.shine) * circle.specular * light.specular.r;
                gSpecular += Math.pow(reflectionDot, circle.shine) * circle.specular * light.specular.g;
                bSpecular += Math.pow(reflectionDot, circle.shine) * circle.specular * light.specular.b;
            }
        }

        let r = rAmbient + rDiffuse + rSpecular;
        let g = gAmbient + gDiffuse + gSpecular;
        let b = bAmbient + bDiffuse + bSpecular;

        // convert 0-1 to 0-255 with clamping
        r = Math.round(mapLinear(0, r, 1, 0, 255));
        g = Math.round(mapLinear(0, g, 1, 0, 255));
        b = Math.round(mapLinear(0, b, 1, 0, 255));
    
        let pixelOffset = 4 * (j * width + i);
        imageData.data[pixelOffset] = r;
        imageData.data[pixelOffset + 1] = g;
        imageData.data[pixelOffset + 2] = b;
        imageData.data[pixelOffset + 3] = 255;
    }
    tempTime = performance.now();
    block3Time = roundToNPlaces(tempTime - prevTime, 3).toString();
    prevTime = tempTime;

    ctx.putImageData(imageData, 0, 0);

    ctx.fillStyle = "white";
    ctx.font = "15px Arial";
    ctx.textAlign = "left";
    ctx.fillText(block1Time, 0, 400);
    ctx.fillText(block2Time, 0, 450);
    ctx.fillText(block3Time, 0, 500);

    previousTimeMillis = currentTimeMillis;

    window.requestAnimationFrame(draw);
}

function mapLinear(fromStart: number, fromValue: number, fromEnd: number, toStart: number, toEnd: number) {
    fromValue = clampValueToRange(fromValue, Math.min(fromStart, fromEnd), Math.max(fromStart, fromEnd));
    let toValue = Math.abs(fromValue - fromStart) * Math.abs(toEnd - toStart) / Math.abs(fromEnd - fromStart);
    if (toEnd > toStart) {
        toValue = toValue + toStart;
    } else {
        toValue = -toValue + toStart;
    }
    return toValue;
}

function clampValueToRange(value: number, lowerBound: number, upperBound: number): number {
    if (value < lowerBound) {
        return lowerBound;
    }
    if (value > upperBound) {
        return upperBound;
    }
    return value;
}
