// 컬러카드 서버(Supabase) 끝단 테스트: 인증코드 확인 → 가입 → 코드 사용 → 뽑기 기록 저장·조회 → 남의 기록 안 보임
const URL_ = "https://ylmhkwetuodxhcgqxckf.supabase.co";
const KEY = "sb_publishable_rBEz3bJbiNIQu0Dd285rTQ_l-H3hVKI";
const CODE = process.env.TEST_CODE || "HARI-TEST-0001";
const email = `test-${Date.now()}@hariplus.kr`, password = "Test-" + Math.random().toString(36).slice(2, 10) + "A1";
let fail = 0;
const H = (tok) => ({ apikey: KEY, Authorization: `Bearer ${tok || KEY}`, "Content-Type": "application/json", Prefer: "return=representation" });
async function step(name, fn) { try { const r = await fn(); console.log(`✅ ${name}`, typeof r === "string" ? r : JSON.stringify(r).slice(0, 200)); return r; } catch (e) { fail++; console.log(`❌ ${name}: ${e.message || e}`); return null; } }
async function j(res) { const t = await res.text(); let d; try { d = JSON.parse(t); } catch { d = t; } if (!res.ok) throw new Error(`${res.status} ${typeof d === "string" ? d : JSON.stringify(d)}`); return d; }

const ok = await step("1 인증코드 확인(check_code=true)", async () => { const d = await j(await fetch(`${URL_}/rest/v1/rpc/check_code`, { method: "POST", headers: H(), body: JSON.stringify({ p_code: CODE }) })); if (d !== true) throw new Error("코드가 유효하지 않음(이미 사용됐거나 미등록): " + JSON.stringify(d)); return d; });
const su = await step("2 가입(signup, 세션 즉시 발급)", async () => { const d = await j(await fetch(`${URL_}/auth/v1/signup`, { method: "POST", headers: H(), body: JSON.stringify({ email, password, data: { nick: "테스트", grade: "e5" } }) })); if (!d.access_token) throw new Error("access_token 없음 → Authentication > Email > Confirm email 이 아직 켜져 있음"); return { user: d.user?.id }; });
const login = await step("3 로그인(password grant)", async () => j(await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: "POST", headers: H(), body: JSON.stringify({ email, password }) })));
const T = login?.access_token;
if (T) {
  await step("4 코드 사용+프로필 생성(redeem_code)", async () => j(await fetch(`${URL_}/rest/v1/rpc/redeem_code`, { method: "POST", headers: H(T), body: JSON.stringify({ p_code: CODE, p_nick: "테스트", p_grade: "e5" }) })));
  await step("5 뽑기 기록 저장(draws insert)", async () => j(await fetch(`${URL_}/rest/v1/draws`, { method: "POST", headers: H(T), body: JSON.stringify({ cat: "A", idx: 3 }) })));
  await step("6 내 기록 조회(draws select) = 1건", async () => { const d = await j(await fetch(`${URL_}/rest/v1/draws?select=cat,idx`, { headers: H(T) })); if (!Array.isArray(d) || d.length !== 1) throw new Error("건수 이상: " + JSON.stringify(d)); return d; });
  await step("7 내 프로필 조회(profiles)", async () => { const d = await j(await fetch(`${URL_}/rest/v1/profiles?select=nick,grade`, { headers: H(T) })); if (!d.length) throw new Error("프로필 없음"); return d; });
  await step("8 같은 코드 재사용 불가(check_code=false)", async () => { const d = await j(await fetch(`${URL_}/rest/v1/rpc/check_code`, { method: "POST", headers: H(), body: JSON.stringify({ p_code: CODE }) })); if (d !== false) throw new Error("아직 true"); return d; });
}
await step("9 로그인 없이 기록 조회 → 0건(RLS)", async () => { const d = await j(await fetch(`${URL_}/rest/v1/draws?select=id`, { headers: H() })); if (d.length !== 0) throw new Error("남의 기록이 보임: " + d.length); return d; });
console.log(fail ? `\nRESULT: FAIL (${fail})` : "\nRESULT: ALL PASS");
process.exit(fail ? 1 : 0);
