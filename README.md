# Finance Dashboard Backend

A robust backend system for a finance dashboard with role-based access control, transaction management, and analytics.
# made in next ts
## Features

- **Role-Based Access Control**: Viewer, Analyst, and Admin roles with granular permissions
- **Transaction Management**: Full CRUD operations with validation
- **Dashboard Analytics**: Aggregated summaries, category totals, monthly trends
- **User Management**: Create users, manage roles and status
- **Input Validation**: Comprehensive validation using Zod
- **Error Handling**: Proper HTTP status codes and error messages
- **Type Safety**: Full TypeScript implementation

## Role Permissions

| Action | Viewer | Analyst | Admin |
|--------|--------|---------|-------|
| View dashboard | ✅ | ✅ | ✅ |
| View transactions | ✅ | ✅ | ✅ |
| Create transactions | ❌ | ✅ | ✅ |
| Update transactions | ❌ | ✅ | ✅ |
| Delete transactions | ❌ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ✅ |

## API Endpoints

### Dashboard
- `GET /api/dashboard/summary` - Get dashboard summary

### Transactions
- `POST /api/transactions` - Create transaction (Analyst+, with validation)
- `GET /api/transactions` - List transactions (with filters)
- `GET /api/transactions/:id` - Get transaction
- `PUT /api/transactions/:id` - Update transaction (Analyst+)
- `DELETE /api/transactions/:id` - Delete transaction (Admin only)

### Users (Admin only)
- `POST /api/users` - Create user
- `GET /api/users` - List users
- `PATCH /api/users/:id/status` - Update user status
- `PATCH /api/users/:id/role` - Update user role

## Setup Instructions

1. **Install dependencies**
   ```bash
   npm install
