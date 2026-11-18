const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../../components/profile/ProfilePageClient.tsx");
const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = [
  "emptyMeasurementForm", "measurementToForm", "cmToRoundedInches", "inchesToCm",
  "cmToUpperBodyInches", "formatUpperBodyLength", "parseOptionalMeasurement",
  "validateMeasurementForm", "measurementFormToCentimeters",
];
const helpers = source.statements
  .filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
  .map(node => node.getText(source)).join("\n");
const compiled = ts.transpileModule(helpers, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const measurements = new Function(compiled + "; return {" + names.join(",") + "};")();

/** Verifies single-field conversion, e.g. 27.5 inches saves as 69.9 cm rather than 2 feet plus 3.5 inches. */
test("upper body length uses one inches value and preserves stored centimeter precision", () => {
  const form = { ...measurements.emptyMeasurementForm(), heightInches: "27.5" };
  assert.equal("heightFeet" in form, false);
  assert.deepEqual(measurements.validateMeasurementForm(form), {});
  const saved = measurements.measurementFormToCentimeters(form);
  assert.equal(saved.heightCm, 69.9);
  const restored = measurements.measurementToForm(saved);
  assert.equal(restored.heightInches, "27.52");
  assert.equal(measurements.measurementFormToCentimeters(restored).heightCm, saved.heightCm);
  assert.equal(measurements.formatUpperBodyLength(saved.heightCm), "27.52 in");
  assert.equal(measurements.formatUpperBodyLength(null), "Not set");
  assert.equal(measurements.measurementFormToCentimeters(measurements.emptyMeasurementForm()).heightCm, null);
});

/** Checks invalid and boundary inputs, e.g. 0, -1 and 97 inches are rejected while 28 and 96 are accepted. */
test("upper body validation accepts torso lengths without a feet or remainder restriction", () => {
  for (const value of ["0", "-1", "invalid", "Infinity", "0.01", "97"]) {
    assert.ok(measurements.validateMeasurementForm({ ...measurements.emptyMeasurementForm(), heightInches: value }).heightInches);
  }
  for (const value of ["", "12", "28", "96"]) {
    assert.deepEqual(measurements.validateMeasurementForm({ ...measurements.emptyMeasurementForm(), heightInches: value }), {});
  }
  assert.doesNotMatch(source.text, /heightFeet|placeholder="ft"|formatHeightUs/);
  assert.match(source.text, /Upper body length \(in inches\)/);
});

/** Checks both views name units and circumferences explicitly, e.g. "Chest circumference (in inches)" appears twice. */
test("all measurement titles specify inches in parentheses", () => {
  const labels = [];
  /** Collects rendered JSX text rather than documentation examples, e.g. excludes JSDoc's Chest label. */
  function collectLabels(node) {
    if (ts.isJsxText(node)) labels.push(node.text.trim().toLowerCase());
    ts.forEachChild(node, collectLabels);
  }
  collectLabels(source);
  for (const title of ["height", "upper body length", "chest circumference", "shoulder width", "arm length", "waist circumference", "hip circumference", "inseam"]) {
    assert.equal(labels.filter(label => label === `${title} (in inches)`).length, 2, title);
    assert.equal(labels.includes(`${title} (in)`), false, title);
  }
  assert.equal(labels.filter(label => label === "weight (in pounds)").length, 2);
  assert.ok(!labels.includes("please enter all measurements in inches."));
});

/** Checks compact stacked rows, e.g. a 224px label column is separated from its input by only 12px. */
test("all nine measurement inputs use compact right-hand columns in stacked rows", () => {
  const inputs = [];
  /** Collects measurement inputs only, e.g. excludes full-width address and phone inputs. */
  function collectInputs(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "input" && node.getText(source).includes("value={measurementForm.")) {
      inputs.push(node.getText(source));
      assert.match(node.parent.openingElement.getText(source), /grid-cols-\[minmax\(0,1fr\)_6rem\]/);
      assert.match(node.parent.openingElement.getText(source), /sm:grid-cols-\[minmax\(0,14rem\)_10rem\]/);
    }
    ts.forEachChild(node, collectInputs);
  }
  collectInputs(source);
  assert.equal(inputs.length, 9);
  for (const input of inputs) {
    assert.match(input, /h-10 w-full max-w-40 rounded-lg/);
  }
});

/** Keeps whole-body height independent, e.g. 68 inches and 150 lb do not change a 27.5-inch torso entry. */
test("whole body weight and height round-trip separately from torso length", () => {
  const form = { ...measurements.emptyMeasurementForm(), weightPounds: "150.5", bodyHeightInches: "68", heightInches: "27.5" };
  assert.deepEqual(measurements.validateMeasurementForm(form), {});
  const saved = measurements.measurementFormToCentimeters(form);
  assert.equal(saved.weightLb, 150.5);
  assert.equal(saved.bodyHeightCm, 172.7);
  assert.equal(saved.heightCm, 69.9);
  const restored = measurements.measurementToForm(saved);
  assert.equal(restored.weightPounds, "150.5");
  assert.equal(measurements.measurementFormToCentimeters(restored).bodyHeightCm, 172.7);
  assert.equal(restored.heightInches, "27.52");
  for (const weightPounds of ["0", "-1", "Infinity", "invalid", "0.001", "100000"]) {
    assert.ok(measurements.validateMeasurementForm({ ...form, weightPounds }).weightPounds);
  }
  for (const bodyHeightInches of ["0", "35", "97", "invalid"]) {
    assert.ok(measurements.validateMeasurementForm({ ...form, bodyHeightInches }).bodyHeightInches);
  }
});

/** Verifies help starts hidden, e.g. initial markup contains a focusable trigger but no visible measuring list. */
test("upper body help is a hidden popup and its input has no placeholder", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const helper = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "UpperBodyLengthInstructions");
  const js = ts.transpileModule(helper.getText(source), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const Component = new Function("require", "exports", "useState", "useId", "useRef", js + "; return UpperBodyLengthInstructions;")(
    require, {}, React.useState, React.useId, React.useRef
  );
  const html = renderToStaticMarkup(React.createElement(Component));
  assert.match(html, /<button[^>]*type="button"[^>]*aria-describedby=/);
  assert.match(html, /How to measure/);
  assert.match(html, /role="tooltip" hidden=""/);
  assert.equal((html.match(/<li>/g) || []).length, 3);
  assert.doesNotMatch(source.text, /placeholder="in"/);
});

/** Loads the profile endpoint with in-memory authentication/storage, e.g. no live database or user records change. */
function profileRoute(saved) {
  const file = path.resolve(__dirname, "../../app/api/profile/route.ts");
  const loaded = new Module(file, module);
  loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(path.dirname(file));
  const mocks = {
    "next-auth": {
      /** Authenticates a synthetic user, e.g. id 1 owns this test's measurements. */
      getServerSession: async () => ({ user: { id: "1" } }),
    },
    "@/lib/auth": { authOptions: {} },
    "@/lib/server/profileStore": {
      /** Captures centimeter writes, e.g. heightCm: 69.9. */
      saveMeasurement: async (userId, measurement) => saved.push({ userId, measurement }),
      /** Returns the captured measurement as the saved profile response. */
      getProfile: async () => ({ measurement: saved.at(-1)?.measurement }),
    },
  };
  /** Resolves test doubles before actual packages, e.g. profileStore never connects to PostgreSQL. */
  loaded.require = function dependency(id) {
    return Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(this, id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, file);
  return loaded.exports;
}

/** Exercises API validation, e.g. 69.9 cm succeeds while zero, negative and oversized lengths never reach storage. */
test("profile API saves torso lengths under the former full-height minimum", async () => {
  const saved = [];
  const route = profileRoute(saved);
  for (const [heightCm, status] of [[69.9, 200], [null, 200], [0, 400], [-1, 400], [244, 400]]) {
    const response = await route.POST(new Request("http://localhost/api/profile", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "measurement", measurement: { heightCm } }),
    }));
    assert.equal(response.status, status);
  }
  assert.equal(saved.length, 2);
  assert.equal(saved[0].measurement.heightCm, 69.9);
});

/** Verifies API units and invalid values, e.g. pounds remain pounds while standing height is received in centimeters. */
test("profile API saves separate whole-body measurements and rejects invalid values", async () => {
  const saved = [];
  const route = profileRoute(saved);
  const valid = { weightLb: 150.5, bodyHeightCm: 172.7, heightCm: 69.9 };
  for (const [measurement, status] of [
    [valid, 200], [{ weightLb: null, bodyHeightCm: null }, 200],
    [{ ...valid, weightLb: 0 }, 400], [{ ...valid, weightLb: "invalid" }, 400],
    [{ ...valid, weightLb: 100000 }, 400], [{ ...valid, bodyHeightCm: 50 }, 400],
    [{ ...valid, bodyHeightCm: "invalid" }, 400],
  ]) {
    const response = await route.POST(new Request("http://localhost/api/profile", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "measurement", measurement }),
    }));
    assert.equal(response.status, status);
  }
  assert.equal(saved.length, 2);
  assert.equal(saved[0].measurement.weightLb, valid.weightLb);
  assert.equal(saved[0].measurement.bodyHeightCm, valid.bodyHeightCm);
  assert.equal(saved[0].measurement.heightCm, valid.heightCm);
});
