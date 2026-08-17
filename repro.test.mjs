// 最小复现：ts-grm 0.0.2 的解析环缺陷
// 场景：基类（Base）声明 m2o(Child) 指向子类，Child extends Base
// 预期：子类模型应能正常解析（Jimmer 中"基类声明关联"是被支持的设计）
// 实际：解析 Child 时递归回到正在解析中的祖先（Base），无重入保护，
//       抛 "The declaredPropMap of Base is not initialized"
// 说明：不需要 lambda 也不需要 .self——ts-grm 的 model() 只存储类（ctor），
//       类体在 resolve 阶段（dto.view 时）才执行，彼时 Child 已定义完毕，
//       直接 prop.m2o(Child) 传模型实例即可。
import { test } from "node:test";
import assert from "node:assert/strict";
import { model, prop, dto } from "@ts-grm/core";

const Base = model("Base", "id", class {
    id = prop.str(36)
    // 基类指向子类的关联（类体在 resolve 阶段才执行，Child 彼时已定义，直接传实例）
    createdBy = prop.m2o(Child).nullable()
}, ctx => ctx.table({ discriminator: "TYPE", discriminatorValue: "Base" }));

const Child = model.extends(Base)("Child", class {
    name = prop.str(32)
}, ctx => ctx.table({ discriminatorValue: "Child" }));

test("基类 m2o 指向子类：子类模型解析失败（解析环）", () => {
    assert.throws(
        () => dto.view(Child, (c) => [c.id]),
        /declaredPropMap of Base is not initialized/,
    );
});

test("对照：同模型自引用（m2o(自身)）可以正常解析", () => {
    const Node = model("Node", "id", class {
        id = prop.str(36)
        parent = prop.m2o(Node).nullable()
    }, ctx => ctx.table({ discriminator: "TYPE", discriminatorValue: "Node" }));

    assert.doesNotThrow(() => dto.view(Node, (c) => [c.id]));
});
