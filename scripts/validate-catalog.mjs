import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseAllDocuments } from 'yaml';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const errors = [];

const ALLOWED_KINDS = new Set([
  'Component',
  'System',
  'API',
  'Resource',
  'Location',
  'Domain',
  'Template',
  'Group',
  'User',
]);

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

function fail(message) {
  errors.push(message);
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'skeleton' || entry.name === 'node_modules') {
        continue;
      }
      files.push(...(await walk(full)));
    } else if (
      (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) &&
      entry.name !== 'mkdocs.yml'
    ) {
      files.push(full);
    }
  }
  return files;
}

function documentsFrom(text, file) {
  let docs;
  try {
    docs = parseAllDocuments(text);
  } catch (error) {
    fail(`${file}: YAML parse error: ${error.message}`);
    return [];
  }
  const entities = [];
  for (const doc of docs) {
    if (doc.errors.length > 0) {
      for (const error of doc.errors) {
        fail(`${file}: ${error.message}`);
      }
      continue;
    }
    const value = doc.toJSON();
    if (value == null) {
      continue;
    }
    entities.push(value);
  }
  return entities;
}

function entityRef(kind, namespace, name) {
  return `${kind.toLowerCase()}:${namespace}/${name}`;
}

function refOf(entity) {
  const namespace = entity.metadata.namespace ?? 'default';
  return entityRef(entity.kind, namespace, entity.metadata.name);
}

function asStringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(item => typeof item === 'string');
}

async function exists(file) {
  try {
    const info = await stat(file);
    return info.isFile();
  } catch {
    return false;
  }
}

const catalogFiles = [
  path.join(root, 'catalog-info.yaml'),
  ...(await walk(path.join(root, 'catalog'))),
];
const templateFiles = (await walk(path.join(root, 'templates'))).filter(file =>
  file.endsWith(`${path.sep}template.yaml`),
);

const entities = [];
for (const file of catalogFiles) {
  const text = await readFile(file, 'utf8');
  if (text.includes('${{')) {
    fail(
      `${path.relative(root, file)} contains a template expression. Catalog files must be concrete entities.`,
    );
  }
  for (const entity of documentsFrom(text, path.relative(root, file))) {
    entities.push({ entity, file: path.relative(root, file) });
  }
}
for (const file of templateFiles) {
  const text = await readFile(file, 'utf8');
  for (const entity of documentsFrom(text, path.relative(root, file))) {
    entities.push({ entity, file: path.relative(root, file) });
  }
}

const seen = new Map();
for (const { entity, file } of entities) {
  if (typeof entity.apiVersion !== 'string' || entity.apiVersion.length === 0) {
    fail(`${file}: missing apiVersion`);
  }
  if (!ALLOWED_KINDS.has(entity.kind)) {
    fail(`${file}: kind ${entity.kind} is not allowed`);
    continue;
  }
  const name = entity.metadata?.name;
  if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
    fail(`${file}: metadata.name is missing or invalid (${name})`);
    continue;
  }
  const ref = refOf(entity);
  if (seen.has(ref)) {
    fail(`${file}: duplicate entity ${ref} (also in ${seen.get(ref)})`);
  } else {
    seen.set(ref, file);
  }

  const spec = entity.spec ?? {};
  if (['Component', 'API', 'System', 'Domain', 'Resource', 'Template'].includes(entity.kind)) {
    if (typeof spec.owner !== 'string' || spec.owner.trim() === '') {
      fail(`${file}: ${ref} is missing spec.owner`);
    }
  }
  if (entity.kind === 'Component' || entity.kind === 'API' || entity.kind === 'Resource') {
    if (typeof spec.type !== 'string' || spec.type.trim() === '') {
      fail(`${file}: ${ref} is missing spec.type`);
    }
  }
  if (entity.kind === 'Component' || entity.kind === 'API') {
    const lifecycle = spec.lifecycle;
    if (!['production', 'experimental', 'deprecated'].includes(lifecycle)) {
      fail(`${file}: ${ref} has invalid lifecycle ${lifecycle}`);
    }
  }
  if (entity.kind === 'API' && typeof spec.definition !== 'string') {
    fail(`${file}: ${ref} is missing spec.definition`);
  }
  if (entity.kind === 'Template') {
    if (!Array.isArray(spec.parameters) || spec.parameters.length === 0) {
      fail(`${file}: ${ref} is missing parameters`);
    }
    if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
      fail(`${file}: ${ref} is missing steps`);
    }
    const fetch = (spec.steps ?? []).find(step => step.action === 'fetch:template');
    if (!fetch || fetch.input?.url !== './skeleton') {
      fail(`${file}: ${ref} must fetch ./skeleton`);
    }
  }
}

function resolveOwner(owner) {
  if (typeof owner !== 'string') {
    return undefined;
  }
  if (owner.includes(':')) {
    return owner.toLowerCase();
  }
  return `group:default/${owner}`;
}

for (const { entity, file } of entities) {
  const spec = entity.spec ?? {};
  const ref = entity.metadata?.name ? refOf(entity) : file;
  if (typeof spec.owner === 'string' && spec.owner.includes(':')) {
    if (!seen.has(spec.owner.toLowerCase())) {
      fail(`${file}: ${ref} owner ${spec.owner} does not exist`);
    }
  }
  if (typeof spec.system === 'string' && !seen.has(`system:default/${spec.system}`)) {
    fail(`${file}: ${ref} system ${spec.system} does not exist`);
  }
  if (typeof spec.domain === 'string' && !seen.has(`domain:default/${spec.domain}`)) {
    fail(`${file}: ${ref} domain ${spec.domain} does not exist`);
  }
  for (const apiName of [
    ...asStringList(spec.providesApis),
    ...asStringList(spec.consumesApis),
  ]) {
    if (!seen.has(`api:default/${apiName}`)) {
      fail(`${file}: ${ref} references missing API ${apiName}`);
    }
  }
  for (const dependency of asStringList(spec.dependsOn)) {
    if (!seen.has(dependency.toLowerCase())) {
      fail(`${file}: ${ref} dependsOn missing ${dependency}`);
    }
  }
  if (entity.kind === 'Group') {
    const namespace = entity.metadata.namespace ?? 'default';
    if (typeof spec.parent === 'string') {
      const parentRef = spec.parent.includes(':')
        ? spec.parent.toLowerCase()
        : entityRef('group', namespace, spec.parent);
      if (!seen.has(parentRef)) {
        fail(`${file}: group parent ${spec.parent} does not exist`);
      }
    }
    for (const child of asStringList(spec.children)) {
      const childRef = child.includes(':')
        ? child.toLowerCase()
        : entityRef('group', namespace, child);
      if (!seen.has(childRef)) {
        fail(`${file}: group child ${child} does not exist`);
      }
    }
    for (const member of asStringList(spec.members)) {
      const memberRef = member.includes(':')
        ? member.toLowerCase()
        : entityRef('user', namespace, member);
      if (!seen.has(memberRef)) {
        fail(`${file}: group member ${member} does not exist`);
      }
    }
  }
  if (entity.kind === 'User') {
    const namespace = entity.metadata.namespace ?? 'default';
    for (const group of asStringList(spec.memberOf)) {
      const groupRef = group.includes(':')
        ? group.toLowerCase()
        : entityRef('group', namespace, group);
      if (!seen.has(groupRef)) {
        fail(`${file}: user memberOf ${group} does not exist`);
      }
    }
  }
}

const skeletons = [
  {
    dir: path.join(root, 'templates/fastapi-service/skeleton'),
    tests: ['tests/test_health.py'],
    extras: ['requirements.txt', 'app/main.py'],
  },
  {
    dir: path.join(root, 'templates/node-service/skeleton'),
    tests: ['src/server.test.ts'],
    extras: ['package.json', 'tsconfig.json', 'src/server.ts'],
  },
];

for (const skeleton of skeletons) {
  const required = [
    'Dockerfile',
    'catalog-info.yaml',
    '.github/workflows/ci.yml',
    ...skeleton.tests,
    ...skeleton.extras,
  ];
  for (const relative of required) {
    if (!(await exists(path.join(skeleton.dir, relative)))) {
      fail(`missing skeleton file ${path.relative(root, path.join(skeleton.dir, relative))}`);
    }
  }
}

if (!(await exists(path.join(root, 'mkdocs.yml')))) {
  fail('missing mkdocs.yml for portal TechDocs');
}
if (!(await exists(path.join(root, 'docs/index.md')))) {
  fail('missing docs/index.md for portal TechDocs');
}

const portal = entities.find(item => item.entity.metadata?.name === 'developer-portal');
const techdocs = portal?.entity.metadata?.annotations?.['backstage.io/techdocs-ref'];
if (techdocs !== 'dir:.') {
  fail('developer-portal must set backstage.io/techdocs-ref: dir:.');
}

if (errors.length > 0) {
  for (const error of errors) {
    process.stderr.write(`${error}\n`);
  }
  process.stderr.write(`${errors.length} catalog validation error(s)\n`);
  process.exit(1);
}

process.stdout.write(
  `Validated ${entities.length} entities and ${skeletons.length} template skeletons\n`,
);
