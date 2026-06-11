import * as assert from "node:assert/strict";
import { test } from "node:test";
import { SequenceSortStrategy } from "../src/domain/strategies/BadgeSort";

interface TestCard {
  id: string;
  text: string;
  x: number;
  y: number;
  badge?: string;
}

function card(
  id: string,
  text: string,
  options: Partial<Pick<TestCard, "x" | "y" | "badge">> = {}
): TestCard {
  return {
    id,
    text,
    x: options.x ?? 0,
    y: options.y ?? 0,
    badge: options.badge,
  };
}

test("序号排序优先使用第一行标题序号，并按层级数字排序", () => {
  const cards = [
    card("ten", "# 10. 总结", { badge: "1" }),
    card("two-ten", "## 2.10 实现细节"),
    card("two-one", "2.1 背景"),
    card("two", "2、概述"),
  ];

  const result = new SequenceSortStrategy("yx").sort(cards);

  assert.deepEqual(result.map((item) => item.id), [
    "two",
    "two-one",
    "two-ten",
    "ten",
  ]);
});

test("第一行没有序号时回退到独立标记", () => {
  const cards = [
    card("badge-ten", "总结", { badge: "10" }),
    card("title-two", "# 2. 标题", { badge: "99" }),
    card("badge-three", "补充", { badge: "3" }),
  ];

  const result = new SequenceSortStrategy("yx").sort(cards);

  assert.deepEqual(result.map((item) => item.id), [
    "title-two",
    "badge-three",
    "badge-ten",
  ]);
});

test("没有标题序号和标记的卡片排在最后并按位置排序", () => {
  const cards = [
    card("plain-right", "普通卡片", { x: 100, y: 0 }),
    card("numbered", "1) 开始", { x: 200, y: 0 }),
    card("plain-left", "另一张普通卡片", { x: 0, y: 100 }),
  ];

  const result = new SequenceSortStrategy("yx").sort(cards);

  assert.deepEqual(result.map((item) => item.id), [
    "numbered",
    "plain-left",
    "plain-right",
  ]);
});

test("正文中的数字不作为第一行序号", () => {
  const cards = [
    card("plain", "2026 年计划", { x: 0, y: 0 }),
    card("numbered", "1. 正式标题", { x: 100, y: 0 }),
  ];

  const result = new SequenceSortStrategy("yx").sort(cards);

  assert.deepEqual(result.map((item) => item.id), ["numbered", "plain"]);
});
