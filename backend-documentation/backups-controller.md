# Backups Controller

## Purpose

Provides backup metadata, schedule configuration, restore simulation, export, and flow data for the backup console.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/backups` | Backup points, summary, and flow |
| POST | `/backups` | Create running backup job record |
| GET | `/backups/schedule` | Read schedule |
| PATCH | `/backups/schedule` | Update schedule |
| POST | `/backups/restore` | Simulate restore |
| GET | `/backups/{backup}/download` | Return metadata download URL |
| GET | `/backups/export?format=csv` | Export backup metadata |
| GET | `/backups/flow` | Backup size/count flow rows |

## Inputs

Backup create requires `scope[]` and `artifact_format`. Schedule accepts frequency, run time, retention, destination mode, and notification user.

## Outputs

Backup list returns `backup_points`, `summary`, and `flow`. Restore returns `restore_result` with `action=restore_simulated`.

## Error Handling

- `403 FORBIDDEN`: non-super-admin access.
- `422 VALIDATION_ERROR`: invalid scope, schedule, restore, or export format.

## Edge Cases

- V1 never performs destructive restore.
- Backup actions never report completion unless a metadata row exists.
- Downloads return metadata URLs only until artifact storage is implemented.

## Acceptance Criteria

- Super admin only.
- Backup create, restore simulation, schedule update, and download are audited.
