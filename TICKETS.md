# 🗂️ Feature Tickets

## Schedule Module
### S-01 — Position Override on Shift
When creating or editing a shift, pre-fill the `position` field with 
the employee's default `role`. Add an "Override" button that unlocks 
the field to enter a different position for that shift only.
Employee's core `role` in the `employees` table is never modified.
**Status:** Backlog

## Employees Module
### E-01 — Position View
Clicking a position shows all employees in that role with:
- Weekly planned vs actual schedule
- Attendance % 
- Overtime hours
- Tasks completed
- Notes
**Status:** In Progress

### E-02 — Add/Edit Positions
Manager can create, rename, and delete custom positions
from a settings panel. Color picker per position.
**Status:** Backlog

## Security
### SEC-01 — Electron ASAR Integrity
Moderate vulnerability in Electron <35.7.5. 
Not exploitable in local dev. Revisit when packaging 
app for distribution. Check for Electron update at that time.
**Status:** Backlog — revisit at distribution stage

### SEC-02 — electron-rebuild audit warnings
8 vulnerabilities in electron-rebuild build tools
(tar, node-gyp, cacache, http-proxy-agent).
Build-time only — not exploitable at runtime.
Monitor for electron-rebuild update that resolves internally.
Do NOT run npm audit fix --force — would downgrade to v2.0.3.
**Status:** Backlog — monitor only