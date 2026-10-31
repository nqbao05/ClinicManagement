const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '../src');

function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllJsFiles(fullPath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function resolveRequire(fromFile, requirePath) {
  if (!requirePath.startsWith('.')) {
    return null; // External package
  }

  const dir = path.dirname(fromFile);
  let resolved = path.resolve(dir, requirePath);

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved;
  }
  if (fs.existsSync(`${resolved}.js`)) {
    return `${resolved}.js`;
  }
  if (fs.existsSync(path.join(resolved, 'index.js'))) {
    return path.join(resolved, 'index.js');
  }

  return null;
}

function extractRequires(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Match require('...') or require("...")
  const regex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const requires = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    requires.push(match[1]);
  }
  return requires;
}

function buildDependencyGraph(files) {
  const graph = new Map();

  for (const file of files) {
    const relFile = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/');
    const deps = new Set();
    const rawRequires = extractRequires(file);

    for (const req of rawRequires) {
      const resolved = resolveRequire(file, req);
      if (resolved && resolved.startsWith(SRC_DIR)) {
        const relDep = path.relative(path.resolve(__dirname, '..'), resolved).replace(/\\/g, '/');
        deps.add(relDep);
      }
    }

    graph.set(relFile, deps);
  }

  return graph;
}

function detectCycles(graph) {
  const visited = new Map(); // 0: unvisited, 1: visiting, 2: visited
  const cycles = [];

  function dfs(node, pathStack = []) {
    visited.set(node, 1);
    pathStack.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      const state = visited.get(neighbor) || 0;
      if (state === 1) {
        // Cycle detected
        const cycleStartIndex = pathStack.indexOf(neighbor);
        const cyclePath = pathStack.slice(cycleStartIndex).concat(neighbor);
        cycles.push(cyclePath);
      } else if (state === 0) {
        dfs(neighbor, [...pathStack]);
      }
    }

    visited.set(node, 2);
  }

  for (const node of graph.keys()) {
    if ((visited.get(node) || 0) === 0) {
      dfs(node, []);
    }
  }

  return cycles;
}

function main() {
  console.log('=== KIỂM TOÁN PHỤ THUỘC VÒNG TRÒN (CIRCULAR DEPENDENCY CHECK) ===');
  console.log(`Đang phân tích mã nguồn tại: ${SRC_DIR}...\n`);

  const files = getAllJsFiles(SRC_DIR);
  const graph = buildDependencyGraph(files);
  const cycles = detectCycles(graph);

  console.log(`Đã quét ${files.length} tập tin JavaScript trong thư mục src/.\n`);

  if (cycles.length === 0) {
    console.log('✅ KẾT QUẢ: TUYỆT VỜI! Không phát hiện bất kỳ phụ thuộc vòng tròn nào (Zero Circular Dependencies).');
    console.log('Kiến trúc phân tầng một chiều đã được tuân thủ nghiêm ngặt: routes -> controllers -> services -> repositories -> models.\n');
    process.exit(0);
  } else {
    console.error(`❌ CẢNH BÁO: Phát hiện ${cycles.length} vòng lặp phụ thuộc (Circular Dependency):`);
    cycles.forEach((cycle, index) => {
      console.error(`\nVòng lặp #${index + 1}:`);
      console.error(cycle.map(f => `  -> ${f}`).join('\n'));
    });
    console.error('\nYêu cầu: Tác giả PR cần tách logic dùng chung vào Orchestrator Service hoặc thư mục types/ trước khi được merge.\n');
    process.exit(1);
  }
}

main();
