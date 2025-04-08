(() => {
  // src/index.ts
  var xSlider = document.getElementById("xInput");
  xSlider.addEventListener("input", () => {
    circles[0].center[0] = parseFloat(xSlider.value);
  });
  var ySlider = document.getElementById("yInput");
  ySlider.addEventListener("input", () => {
    circles[0].center[1] = parseFloat(ySlider.value);
  });
  var zSlider = document.getElementById("zInput");
  zSlider.addEventListener("input", () => {
    circles[0].center[2] = parseFloat(zSlider.value);
  });
  var fpsCounter = document.getElementById("fpsCounter");
  var previousTimeMillis;
  var width = 1e3;
  var height = 600;
  var canvas = document.getElementById("mainCanvas");
  canvas.width = width;
  canvas.height = height;
  var ctx = canvas.getContext("2d");
  var imageData = ctx.createImageData(width, height);
  var yOne = height / width;
  var x1 = [0, yOne, 0];
  var x2 = [1, yOne, 0];
  var x3 = [0, 0, 0];
  var x4 = [1, 0, 0];
  var camera = [0.5, yOne / 2, -1];
  var circles = [
    { index: 0, ambient: { r: 1, g: 0, b: 0 }, diffuse: 0.7, specular: 0.5, shine: 15, center: [0.5, yOne / 2, 1.9], radius: 0.5 },
    { index: 1, ambient: { r: 0, g: 1, b: 0 }, diffuse: 0.7, specular: 0.5, shine: 15, center: [0.1, 0.8, 1.6], radius: 0.3 },
    { index: 2, ambient: { r: 0, g: 0, b: 1 }, diffuse: 0.7, specular: 0.5, shine: 15, center: [0.9, 0, 1.8], radius: 0.1 }
  ];
  ySlider.value = circles[0].center[1].toString();
  var lights = [
    { center: [6, 2, 1], diffuse: { r: 0.5, g: 0.5, b: 0.5 }, specular: { r: 0.5, g: 0.5, b: 0.5 } },
    { center: [-2, 2, 0], diffuse: { r: 0.2, g: 0.2, b: 0.2 }, specular: { r: 0.2, g: 0.2, b: 0.2 } }
  ];
  var ambientLight = { r: 0.2, g: 0.2, b: 0.2 };
  function scaleInPlace3(dest, vector, scalar) {
    dest[0] = scalar * vector[0];
    dest[1] = scalar * vector[1];
    dest[2] = scalar * vector[2];
  }
  function addInPlace3(dest, v1, v2) {
    dest[0] = v1[0] + v2[0];
    dest[1] = v1[1] + v2[1];
    dest[2] = v1[2] + v2[2];
  }
  function subtractInPlace3(dest, v1, v2) {
    dest[0] = v1[0] - v2[0];
    dest[1] = v1[1] - v2[1];
    dest[2] = v1[2] - v2[2];
  }
  function product3(v1, v2) {
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  }
  function normalizeInPlace(v) {
    let scalar = 1 / Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    v[0] *= scalar;
    v[1] *= scalar;
    v[2] *= scalar;
  }
  var intersect3Temp = [0, 0, 0];
  function intersect3(point, direction, circle) {
    let center = circle.center;
    let r = circle.radius;
    let d = direction;
    let o = point;
    intersect3Temp[0] = o[0] - center[0];
    intersect3Temp[1] = o[1] - center[1];
    intersect3Temp[2] = o[2] - center[2];
    let a = product3(d, d);
    let b = 2 * product3(intersect3Temp, d);
    let c = product3(intersect3Temp, intersect3Temp) - r * r;
    let discriminant = b * b - 4 * a * c;
    if (discriminant < 0) {
      return void 0;
    }
    let toAdd = Math.sqrt(discriminant);
    let t1 = (-b - toAdd) / (2 * a);
    let t2 = (-b + toAdd) / (2 * a);
    let t = t1 < 1 ? t2 : t1;
    return t;
  }
  function roundToNPlaces(x, numPlaces) {
    let scale = Math.pow(10, numPlaces);
    return Math.round(x * scale) / scale;
  }
  var rays = [];
  var numPixels = width * height;
  for (let i = 0; i < numPixels; i++) {
    rays.push({ pixel: { i: -1, j: -1 }, direction: [0, 0, 0] });
  }
  var intersections = [];
  var numIntersections = 0;
  for (let i = 0; i < numPixels; i++) {
    intersections.push({ ray: rays[0], closestIntersection: { circle: circles[0], t: 0 } });
  }
  var block1Time;
  var block2Time;
  var block3Time;
  var normal = [0, 0, 0];
  var pointOfIntersection = [0, 0, 0];
  var lightDirection = [0, 0, 0];
  var shadowDirection = [0, 0, 0];
  var reflection = [0, 0, 0];
  var viewDirection = [0, 0, 0];
  window.requestAnimationFrame(draw);
  function draw(currentTimeMillis) {
    let fps = 1e3 / (currentTimeMillis - previousTimeMillis);
    if (!isNaN(fps)) {
      fpsCounter.innerText = "FPS: " + roundToNPlaces(fps, 2);
    }
    for (let i = 0; i < width * height; i++) {
      imageData.data[4 * i] = 0;
      imageData.data[4 * i + 1] = 0;
      imageData.data[4 * i + 2] = 0;
      imageData.data[4 * i + 3] = 255;
    }
    let prevTime = performance.now();
    let tempTime = 0;
    let hIncrement = 1 / width;
    let vIncrement = 1 / height;
    let horizontal = hIncrement / 2;
    for (let i = 0; i < width; i++) {
      let vertical = vIncrement / 2;
      for (let j = 0; j < height; j++) {
        let rayIndex = i * height + j;
        rays[rayIndex].pixel.i = i;
        rays[rayIndex].pixel.j = j;
        rays[rayIndex].direction[0] = (1 - vertical) * ((1 - horizontal) * x1[0] + horizontal * x2[0]) + vertical * ((1 - horizontal) * x3[0] + horizontal * x4[0]) - camera[0];
        rays[rayIndex].direction[1] = (1 - vertical) * ((1 - horizontal) * x1[1] + horizontal * x2[1]) + vertical * ((1 - horizontal) * x3[1] + horizontal * x4[1]) - camera[1];
        rays[rayIndex].direction[2] = (1 - vertical) * ((1 - horizontal) * x1[2]) + vertical * ((1 - horizontal) * x3[2] + horizontal * x4[2]) - camera[2];
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
        if (t === void 0 || t < 1) {
          continue;
        }
        let intersection = { circle, t };
        if (closestIntersection === void 0 || closestIntersection.t > intersection.t) {
          closestIntersection = intersection;
        }
      }
      if (closestIntersection !== void 0) {
        intersections[numIntersections].ray = rays[k];
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
          for (let m = 0; m < circles.length; m++) {
            if (circles[m].index === circle.index) {
              continue;
            }
            subtractInPlace3(shadowDirection, lightCenter, pointOfIntersection);
            let shadowT = intersect3(pointOfIntersection, shadowDirection, circles[m]);
            if (shadowT !== void 0 && shadowT > 0) {
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
        scaleInPlace3(reflection, normal, 2 * normalDot);
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
      r = clampValueToRange(Math.round(r * 255), 0, 255);
      g = clampValueToRange(Math.round(g * 255), 0, 255);
      b = clampValueToRange(Math.round(b * 255), 0, 255);
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
    previousTimeMillis = currentTimeMillis;
    window.requestAnimationFrame(draw);
  }
  function clampValueToRange(value, lowerBound, upperBound) {
    if (value < lowerBound) {
      return lowerBound;
    }
    if (value > upperBound) {
      return upperBound;
    }
    return value;
  }
})();
//# sourceMappingURL=bundle.js.map
