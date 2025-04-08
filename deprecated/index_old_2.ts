let xSlider = <HTMLInputElement> document.getElementById("xInput");
xSlider.addEventListener("input", () => {circles[0].center.x = parseFloat(xSlider.value)});
let ySlider = <HTMLInputElement> document.getElementById("yInput");
ySlider.addEventListener("input", () => {circles[0].center.y = parseFloat(ySlider.value)});
let zSlider = <HTMLInputElement> document.getElementById("zInput");
zSlider.addEventListener("input", () => {circles[0].center.z = parseFloat(zSlider.value)});

let width = 1000;
let height = 600;

let canvas = <HTMLCanvasElement> document.getElementById("mainCanvas");
canvas.width = width;
canvas.height = height;
let ctx = canvas.getContext("2d");

// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas
let imageData = ctx.createImageData(width, height);

let yOne = height / width;
let x1 = {x: 0, y: yOne, z: 0};
let x2 = {x: 1, y: yOne, z: 0};
let x3 = {x: 0, y: 0, z: 0};
let x4 = {x: 1, y: 0, z: 0};
let camera = {x: 0.5, y: yOne/2, z: -1}; // camera

let circles = [
    {center: {x: 0.5, y: yOne/2, z: 1.9}, radius: 0.5},
    {center: {x: 0.1, y: 0.8, z: 1.6}, radius: 0.3},
    {center: {x: 0.9, y: 0, z: 1.8}, radius: 0.1},
];

interface Vector {
    x: number;
    y: number;
    z: number;
}

function scale(vector: Vector, scalar: number) {
    return {x: scalar * vector.x, y: scalar * vector.y, z: scalar * vector.z};
}

function add(v1: Vector, v2: Vector) {
    return {x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z};
}

function product(v1: Vector, v2: Vector) {
    return v1.x*v2.x + v1.y*v2.y + v1.z*v2.z;
}

// o = p - c

// ctx.putImageData(imageData, 0, 0);
// const getColorIndicesForCoord = (x, y, width) => {
//     const red = y * (width * 4) + x * 4;
//     return [red, red + 1, red + 2, red + 3];
// };
// const colorIndices = getColorIndicesForCoord(xCoord, yCoord, canvasWidth);

window.requestAnimationFrame(draw);
function draw(currentTimeMillis: number) {
    // fill all pixels with black
    for (let i = 0; i < width*height; i++) {
        imageData.data[4*i] = 0;
        imageData.data[4*i+1] = 0;
        imageData.data[4*i+2] = 0;
        imageData.data[4*i+3] = 255;
    }

    let rays = [];
    let hIncrement = 1 / width;
    let vIncrement = 1 / height;
    let horizontal = hIncrement/2;
    for (let i = 0; i < width; i++) {
        let vertical = vIncrement/2;
        for (let j = 0; j < height; j++) {
            let t1 = add(scale(x1, 1 - horizontal), scale(x2, horizontal));
            let t2 = add(scale(x3, 1 - horizontal), scale(x4, horizontal));
            let p = add(scale(t1, 1 - vertical), scale(t2, vertical));
            let d = add(p, scale(camera, -1));
            rays.push({pixel: {i: i, j: j}, ray: d});
            vertical += vIncrement;
        }
        horizontal += hIncrement;
    }

    let xMin = rays[0].ray.x;
    let xMax = rays[0].ray.x;
    let yMin = rays[0].ray.y;
    let yMax = rays[0].ray.y;
    for (let i = 1; i < rays.length; i++) {
        let ray = rays[i].ray;
        if (ray.x < xMin) {
            xMin = ray.x;
        }
        if (ray.x > xMax) {
            xMax = ray.x;
        }
        if (ray.y < yMin) {
            yMin = ray.y;
        }
        if (ray.y > yMax) {
            yMax = ray.y;
        }
    }

    let intersections = [];
    for (let k = 0; k < rays.length; k++) {
        let inters = [];
        for (let n = 0; n < circles.length; n++) {
            let center = circles[n].center;
            let r = circles[n].radius;
            let d = rays[k].ray; // d for direction
            
            // compute quadratic coefficients
            let temp = add(camera, scale(center, -1));
            let a = product(d, d);
            let b = 2 * product(temp, d);
            let c = product(temp, temp) - r * r;

            let discriminant = b*b - 4*a*c;
            if (discriminant < 0) {
                continue;
            }
            let toAdd = Math.sqrt(discriminant);
            let t1 = (-b - toAdd) / (2 * a);
            let t2 = (-b + toAdd) / (2 * a); // we know t2 is greater than t1
            let t = t1 < 1 ? t2 : t1;
            if (t < 1) {
                continue; // the intersection occured between the camera and the view plane
            }

            inters.push({circle: n, t: t});
        }
        if (inters.length > 0) {
            intersections.push({ray: rays[k], intersections: inters});
        }
    }

    for (let k = 0; k < intersections.length; k++) {
        let ray = intersections[k].ray.ray;
        let i = intersections[k].ray.pixel.i;
        let j = intersections[k].ray.pixel.j;

        let inters = intersections[k].intersections;
        let closest = inters[0];
        for (let n = 1; n < inters.length; n++) {
            if (inters[n].t < closest.t) {
                closest = inters[n];
            }
        }

        let r: number, g: number, b: number;
        if (closest.circle === 0) {
            r = 1;
            g = 0;
            b = 0;
        } else if (closest.circle === 1) {
            r = 0;
            g = 1;
            b = 0;
        } else if (closest.circle === 2) {
            r = 0;
            g = 0;
            b = 1;
        }

        // darken based on distance;
        let darkness = 1 - (closest.t/3) * (closest.t/3);
        r *= darkness;
        g *= darkness;
        b *= darkness;

        // convert 0-1 to 0-255
        r = Math.round(mapLinear(0, r, 1, 0, 255));
        g = Math.round(mapLinear(0, g, 1, 0, 255));
        b = Math.round(mapLinear(0, b, 1, 0, 255));
    
        let pixelOffset = 4 * (j * width + i);
        imageData.data[pixelOffset] = r;
        imageData.data[pixelOffset + 1] = g;
        imageData.data[pixelOffset + 2] = b;
        imageData.data[pixelOffset + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    // window.requestAnimationFrame(draw);
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
