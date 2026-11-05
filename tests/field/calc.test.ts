import { test } from "node:test";
import assert from "node:assert/strict";
const { lib }: typeof import("./load") = await import(new URL("./load.ts", import.meta.url).href);

const { missingDiaryDays, expectedDays, diaryTotals, copyDiary, distanceM, skillMatch, suggestTech, overloaded, warrantyEnd, warrantyState, billingSchedule, contractRevenue, renewalDue, addMonths, lowStock } = await lib("calc");
const { promptPayPayload, crc16, promptPayKind } = await lib("promptpay");

test("diary coverage: expected Mon–Sat days and the missing ones", () => {
  // 2026-11-01 is a Sunday
  assert.deepEqual(expectedDays("2026-11-01", "2026-11-04", [1, 2, 3, 4, 5, 6]), ["2026-11-02", "2026-11-03", "2026-11-04"]);
  assert.deepEqual(missingDiaryDays(["2026-11-02", "2026-11-04"], "2026-11-01", "2026-11-04", [1, 2, 3, 4, 5, 6]), ["2026-11-03"]);
});

test("diary totals and copy from yesterday", () => {
  const d = {
    id: "DIA-X-20261103",
    projectId: "X",
    date: "2026-11-03",
    weatherAm: "rain",
    weatherPm: "storm",
    rainHours: 2,
    manpower: [
      { group: "ทีมบริษัท", trade: "กรรมกร", count: 4 },
      { group: "หจก. ไฟฟ้า", trade: "ไฟฟ้า", count: 3 },
    ],
    equipment: [{ name: "รถขุด", hours: 6 }],
    work: [{ text: "ก่ออิฐ", pct: 40 }, { text: "เสร็จแล้ว", pct: 100 }, { text: " " }],
    photos: [{ id: "m" }],
    issues: "ฝนตก",
    by: "a",
    status: "approved",
  };
  assert.deepEqual(diaryTotals(d), { headcount: 7, own: 4, sub: 3, equipmentHours: 6, workLines: 2 });
  const c = copyDiary(d, "2026-11-04", "b", "DIA-X-20261104");
  assert.equal(c.status, "draft");
  assert.equal(c.photos.length, 0);
  assert.equal(c.issues, undefined);
  assert.equal(c.manpower.length, 2);
  assert.notEqual(c.manpower[0], d.manpower[0]);
  assert.deepEqual(c.work.map((w: { text: string }) => w.text), ["ก่ออิฐ", " "]);
});

test("GPS distance", () => {
  assert.equal(distanceM(13.7, 100.5, 13.7, 100.5), 0);
  const m = distanceM(13.7, 100.5, 13.701, 100.5); // ~111 m per 0.001°
  assert.ok(m > 105 && m < 116, String(m));
});

test("dispatch: skill match, suggestion and overload", () => {
  assert.equal(skillMatch("hvac", "ช่างแอร์"), true);
  assert.equal(skillMatch("elec", "ช่างแอร์"), false);
  assert.equal(skillMatch("arch", "ช่างซ่อมบำรุงทั่วไป (ปูน/สี/กระเบื้อง)"), true);
  const techs = [{ name: "A", skill: "ช่างไฟฟ้า" }, { name: "B", skill: "ช่างไฟฟ้า" }, { name: "C", skill: "ช่างแอร์" }];
  const jobs = [{ id: "1", tech: "A", date: "2026-11-05" }];
  assert.equal(suggestTech("elec", "2026-11-05", techs, jobs), "B");
  assert.equal(suggestTech("hvac", "2026-11-05", techs, jobs), "C");
  const many = [1, 2, 3, 4].map((i) => ({ id: String(i), tech: "A", date: "2026-11-05" }));
  assert.deepEqual(overloaded(many, 3), [{ tech: "A", date: "2026-11-05", count: 4 }]);
  assert.deepEqual(lowStock([{ qty: 1, min: 2 }, { qty: 5, min: 2 }, { qty: 2, min: 2 }]).length, 2);
});

test("warranty periods", () => {
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(warrantyEnd({ start: "2021-11-20", months: 60 }), "2026-11-20");
  assert.equal(warrantyState("2026-11-20", "2026-11-04", 60), "expiring");
  assert.equal(warrantyState("2027-11-20", "2026-11-04", 60), "active");
  assert.equal(warrantyState("2026-10-01", "2026-11-04", 60), "expired");
});

test("service contract billing and revenue", () => {
  const c = { start: "2026-02-01", end: "2027-01-31", price: 14_400, billing: "quarterly", status: "active" };
  const b = billingSchedule(c);
  assert.deepEqual(b.map((x: { date: string }) => x.date), ["2026-02-01", "2026-05-01", "2026-08-01", "2026-11-01"]);
  assert.equal(b[0].amount, 3_600);
  const r = contractRevenue([c, { ...c, status: "cancelled" }], "2026-11-04");
  assert.equal(r.runRate, 14_400);
  assert.equal(r.billedYtd, 14_400);
  assert.equal(r.toBill, 0);
  assert.equal(renewalDue({ end: "2026-11-20", status: "active" }, "2026-11-04", 30), true);
  assert.equal(renewalDue({ end: "2027-01-31", status: "active" }, "2026-11-04", 30), false);
});

test("PromptPay payload (EMVCo) with CRC16", () => {
  assert.equal(crc16("123456789"), "29B1"); // CRC-16/CCITT-FALSE check value
  assert.equal(promptPayKind("081-234-5678"), "phone");
  assert.equal(promptPayKind("0105557081236"), "taxId");
  assert.equal(promptPayKind("12345"), null);
  const p = promptPayPayload("0812345678");
  assert.equal(p, "00020101021129370016A000000677010111011300668123456785802TH53037646304" + crc16("00020101021129370016A000000677010111011300668123456785802TH53037646304"));
  const q = promptPayPayload("0105557081236", 1500);
  assert.ok(q.startsWith("000201010212"));
  assert.ok(q.includes("0213" + "0105557081236"));
  assert.ok(q.includes("54071500.00"));
  assert.equal(q.slice(-4), crc16(q.slice(0, -4)));
  assert.throws(() => promptPayPayload("123"));
});
