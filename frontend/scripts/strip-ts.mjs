import fs from "fs/promises";
import path from "path";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";

const ROOT = path.resolve("src");
const exts = new Set([".js", ".jsx", ".ts", ".tsx"]);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(await walk(full));
    else if (exts.has(path.extname(e.name))) files.push(full);
  }
  return files;
}

function strip(code) {
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  traverse(ast, {
    ImportDeclaration(p) {
      const { node } = p;
      if (node.importKind === "type") return p.remove();
      node.specifiers = node.specifiers.filter((s) => s.importKind !== "type");
      if (!node.specifiers.length && !node.source) p.remove();
    },

    TSInterfaceDeclaration(p) {
      p.remove();
    },
    TSTypeAliasDeclaration(p) {
      p.remove();
    },
    TSModuleDeclaration(p) {
      p.remove();
    },

    VariableDeclarator(p) {
      if (p.node.id && p.node.id.typeAnnotation)
        p.node.id.typeAnnotation = null;
    },

    FunctionDeclaration(p) {
      if (p.node.returnType) p.node.returnType = null;
      if (p.node.typeParameters) p.node.typeParameters = null;
      for (const param of p.node.params) {
        if (param.typeAnnotation) param.typeAnnotation = null;
      }
    },
    FunctionExpression(p) {
      if (p.node.returnType) p.node.returnType = null;
      if (p.node.typeParameters) p.node.typeParameters = null;
      for (const param of p.node.params) {
        if (param.typeAnnotation) param.typeAnnotation = null;
      }
    },
    ArrowFunctionExpression(p) {
      if (p.node.returnType) p.node.returnType = null;
      if (p.node.typeParameters) p.node.typeParameters = null;
      for (const param of p.node.params) {
        if (param.typeAnnotation) param.typeAnnotation = null;
      }
    },

    TSAsExpression(p) {
      p.replaceWith(p.node.expression);
    },
    TSSatisfiesExpression(p) {
      p.replaceWith(p.node.expression);
    },
    TSNonNullExpression(p) {
      p.replaceWith(p.node.expression);
    },
  });

  return generate.default(ast, { retainLines: true }).code;
}

const files = await walk(ROOT);

for (const file of files) {
  const code = await fs.readFile(file, "utf8");
  try {
    const out = strip(code);
    if (out !== code) await fs.writeFile(file, out, "utf8");
    console.log("stripped:", file);
  } catch (err) {
    console.error("SKIP (parse failed):", file);
    console.error(String(err.message || err));
  }
}
