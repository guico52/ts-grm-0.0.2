// 最小复现：ts-grm 0.0.2 的解析环缺陷
// 场景：基类（Base）声明 m2o.self(() => Child) 指向子类，Child extends Base
// 预期：子类模型应能正常解析（Jimmer 中"基类声明关联"是被支持的设计）
// 实际：解析 Child 时递归回到正在解析中的祖先（Base），无重入保护，
//       抛 "The declaredPropMap of Base is not initialized"
import { test } from "node:test";
import assert from "node:assert/strict";
import { model, prop, dto } from "@ts-grm/core";

const Base = model("Base", "id", class {
    id = prop.str(36)
    // 基类指向子类的关联（.self 惰性 getter 只能解决模块加载时序，解决不了 Entity 解析重入）
    createdBy = prop.m2o.self(() => Child).nullable()
}, ctx => ctx.table({ discriminator: "TYPE", discriminatorValue: "Base" }));

const Child = model.extends(Base)("Child", class {
    name = prop.str(32)
}, ctx => ctx.table({ discriminatorValue: "Child" }));

test("基类 m2o.self 指向子类：子类模型解析失败（解析环）", () => {
    assert.throws(
        () => dto.view(Child, (c) => [c.id]),
        /declaredPropMap of Base is not initialized/,
    );
});

test("对照：同模型自引用（.self(() => 自身)）可以正常解析", () => {
    const Node = model("Node", "id", class {
        id = prop.str(36)
        parent = prop.m2o.self(() => Node).nullable()
    }, ctx => ctx.table({ discriminator: "TYPE", discriminatorValue: "Node" }));

    assert.doesNotThrow(() => dto.view(Node, (c) => [c.id]));
});
