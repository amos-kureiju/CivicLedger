const VERTEX = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = vec2(position.x, -position.y) * .5 + .5;
  gl_Position = vec4(position, 0., 1.);
}
`;

const FRAGMENT = `
precision mediump float;
varying vec2 uv;
uniform sampler2D artwork;
uniform sampler2D depthMap;
uniform vec2 crop;
uniform vec2 camera;
uniform float progress;
uniform float clock;
void main() {
  vec2 p = (uv - .5) * crop * .974 + .5;
  float depth = texture2D(depthMap, p).r;
  vec2 offset = camera * mix(.0015, .021, depth);
  offset.y += sin(clock * .64 + depth * 3.) * .0036 * depth * depth;
  offset.y -= (1. - progress) * mix(.002, .038, depth);
  vec2 sampleAt = p - offset;
  vec3 color = texture2D(artwork, sampleAt).rgb;
  float streak = (p.x + p.y * .55 - mod(clock * .075, 2.5) + .45) * 9.;
  float sweep = exp(-streak * streak);
  color += (1. - color) * sweep * (.052 - depth * .024);
  gl_FragColor = vec4(color, 1.);
}
`;

// Soft depth regions correspond to silhouettes in the approved square artwork.
const planes: Array<[number, number[]]> = [
  [85, [.067,.247, .094,.207, .592,.137, .626,.138, .654,.177, .704,.390, .597,.664, .172,.587]],
  [150, [.596,.244, .615,.219, .879,.178, .909,.196, .926,.324, .904,.348, .647,.378, .62,.355]],
  [170, [.097,.621, .113,.594, .471,.537, .501,.552, .562,.768, .542,.809, .166,.861, .137,.831]],
  [183, [.577,.668, .593,.643, .887,.587, .919,.601, .938,.689, .925,.711, .635,.764, .606,.749]],
  [192, [.434,.846, .448,.83, .727,.764, .749,.775, .776,.834, .757,.862, .483,.918, .454,.903]],
  [240, [.479,.462, .495,.439, .89,.356, .913,.379, .951,.528, .938,.554, .552,.637, .523,.622]],
];

function makeDepthMap() {
  const map = document.createElement("canvas");
  map.width = 512;
  map.height = 512;
  const ctx = map.getContext("2d");
  if (!ctx) return null;
  const room = ctx.createLinearGradient(0, 40, 0, 512);
  room.addColorStop(0, "#141414");
  room.addColorStop(1, "#333333");
  ctx.fillStyle = room;
  ctx.fillRect(0, 0, 512, 512);
  ctx.filter = "blur(7px)";
  for (const [depth, points] of planes) {
    ctx.beginPath();
    ctx.moveTo(points[0] * 512, points[1] * 512);
    for (let i = 2; i < points.length; i += 2) {
      ctx.lineTo(points[i] * 512, points[i + 1] * 512);
    }
    ctx.closePath();
    ctx.fillStyle = `rgb(${depth}, ${depth}, ${depth})`;
    ctx.fill();
  }
  return map;
}

function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const compiled = gl.createShader(type);
  if (!compiled) throw new Error("Shader unavailable");
  gl.shaderSource(compiled, source);
  gl.compileShader(compiled);
  if (gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) return compiled;
  gl.deleteShader(compiled);
  throw new Error("Shader compilation failed");
}

export function createShowcaseRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, powerPreference: "low-power" });
  const map = makeDepthMap();
  if (!gl || !map) return null;

  function texture(unit: number, source: TexImageSource) {
    const target = gl!.createTexture();
    gl!.activeTexture(gl!.TEXTURE0 + unit);
    gl!.bindTexture(gl!.TEXTURE_2D, target);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, source);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    return target;
  }

  const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!program) throw new Error("Program unavailable");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    throw new Error("Program linking failed");
  }
  gl.useProgram(program);
  const rectangle = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rectangle);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const imageTexture = texture(0, image);
  const depthTexture = texture(1, map);
  gl.uniform1i(gl.getUniformLocation(program, "artwork"), 0);
  gl.uniform1i(gl.getUniformLocation(program, "depthMap"), 1);
  const crop = gl.getUniformLocation(program, "crop");
  const camera = gl.getUniformLocation(program, "camera");
  const progress = gl.getUniformLocation(program, "progress");
  const clock = gl.getUniformLocation(program, "clock");

  return {
    resize(width: number, height: number) {
      const density = Math.min(window.devicePixelRatio || 1, 1.25, 1150 / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * density));
      canvas.height = Math.max(1, Math.round(height * density));
      gl.viewport(0, 0, canvas.width, canvas.height);
      const ratio = width / height / (image.naturalWidth / image.naturalHeight);
      gl.uniform2f(crop, Math.min(ratio, 1), Math.min(1 / ratio, 1));
    },
    draw(x: number, y: number, entrance: number, time: number) {
      gl.uniform2f(camera, x, y);
      gl.uniform1f(progress, entrance);
      gl.uniform1f(clock, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      gl.deleteTexture(imageTexture);
      gl.deleteTexture(depthTexture);
      gl.deleteBuffer(rectangle);
      gl.deleteProgram(program);
    },
  };
}
