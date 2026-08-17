# ts-grm-0.0.2：解析环缺陷复现（基类 m2o 指向子类）

复现 ts-grm 0.0.2（npm 官方包）的模型解析缺陷：

- **场景**：基类 `Base` 声明 `createdBy = prop.m2o.self(() => Child)`（基类关联指向**子类**），
  `Child extends Base`。
- **预期**：子类模型应正常解析——Jimmer 中"基类（映射超类）声明关联"是被支持的设计。
- **实际**：解析 `Child` 时，先解析祖先 `Base`，`Base.createdBy` 的 target `Child`
  又触发对 `Child` 的递归解析（**正在解析中的实体被重入**，ts-grm 无重入保护），
  抛 `The declaredPropMap of Base is not initialized`。
- **对照**：同模型自引用（`parent = prop.m2o.self(() => Node)`）可以正常解析——
  缺陷只出现在"基类 → 子类"方向。

## 运行

```bash
npm install   # 仅安装 @ts-grm/core@0.0.2
npm test
```

预期：两个测试均通过（即缺陷被复现，且对照用例证明同模型自引用无此问题）。

## 最小复现（10 行）

```ts
const Base = model("Base", "id", class {
    id = prop.str(36)
    createdBy = prop.m2o.self(() => Child).nullable()   // 基类 → 子类
}, ctx => ctx.table({ discriminator: "TYPE", discriminatorValue: "Base" }));

const Child = model.extends(Base)("Child", class {
    name = prop.str(32)
}, ctx => ctx.table({ discriminatorValue: "Child" }));

dto.view(Child, (c) => [c.id]);   // → declaredPropMap of Base is not initialized
```

## Jimmer 对这类问题的处理方式（供对照）

ts-grm 是 Jimmer 的 TypeScript 移植，但两者的元模型机制不同，Jimmer 不存在此问题：

1. **编译期静态元模型（APT）**：Jimmer 的实体元模型由注解处理器在**编译期**生成静态类
   （如 `PermissionBase$`），不存在运行时"注册 + 惰性解析"，因此没有
   "解析顺序 / 递归重入"的概念。关联 target 是编译期的 Java `Class` 引用，
   Java 类加载器天然处理类间的循环引用。
2. **基类声明关联是被支持的设计**：官方测试
   `jimmer-sql/src/test/.../inheritance/PermissionBase.java`：

   ```java
   @MappedSuperclass
   public interface PermissionBase extends NamedEntity {
       @ManyToOne
       @Nullable
       Role getRole();          // 映射超类声明 @ManyToOne，与 createdBy → SysUser 同构
   }
   ```

   且 `Permission extends PermissionBase`（实体继承映射超类）有完整测试覆盖。
3. **无"不能指向派生类"限制**：注解处理器对关联 target 的校验只要求
   `targetType.isEntity()`，没有"关联不能指向继承体系内/派生类"的限制。
4. **结论**：`createdBy`/`updatedBy`/`enterprise` 这类"基类关联"在 Jimmer 语义里
   是合法设计。ts-grm 将编译期元模型改为运行时注册 + 惰性解析后，
   解析递归缺少对"解析中实体"的重入保护，是移植实现缺陷。

## 建议修复方向（给上游）

- Entity `resolve` 时维护"解析中"状态集合，重入时复用/等待；
- 或把关联 target 的解析延迟到首次实际使用（查询）时。

环境：Node >= 20（ESM）。
