# ДомойСкорей - Production Readiness Plan

## Current State Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Yandex OAuth | Working | Backend complete, frontend functional |
| Yandex Maps (Create) | Working | Location picker in CreatePost |
| Yandex Maps (View) | Missing | No map in post detail modal |
| Post CRUD API | Complete | All endpoints functional |
| Post Edit/Delete UI | Missing | No buttons in frontend |
| Image Upload | Partial | Base64 only, no cloud storage |
| Search | Working | Full-text with Russian language |
| Match Suggestions | Partial | API exists, not shown in UI |

---

## Phase 1: Critical UI Fixes (Immediate)

### 1.1 Fix Yandex Login Button Icon
- **File**: `App.tsx:128-130`
- **Task**: Replace generic checkmark with Yandex logo
- **Effort**: 15 min

### 1.2 Add Map to Post Detail Modal
- **File**: `App.tsx` (post detail section)
- **Task**: Create read-only map component showing post location
- **New Component**: `components/LocationMap.tsx` (simplified YandexMap)
- **Effort**: 1-2 hours

### 1.3 Show Coordinates Info
- **File**: `App.tsx`
- **Task**: Display "Показать на карте" link in post details
- **Effort**: 30 min

---

## Phase 2: Post Management UI

### 2.1 Add Edit Button for Own Posts
- **File**: `App.tsx` (post detail modal)
- **Task**: Show edit button when `post.user.id === currentUser.id`
- **Effort**: 1 hour

### 2.2 Create Edit Post Modal
- **File**: `components/EditPost.tsx`
- **Task**: Reuse CreatePost form with pre-filled data
- **Effort**: 2 hours

### 2.3 Add Delete Button with Confirmation
- **File**: `App.tsx`
- **Task**: Delete button + confirmation dialog
- **Effort**: 1 hour

---

## Phase 3: Match Suggestions

### 3.1 Display Matches in Post Detail
- **File**: `App.tsx`
- **Task**: Call `/api/search/matches/:postId` and show results
- **Effort**: 2 hours

### 3.2 Match Card Component
- **File**: `components/MatchCard.tsx`
- **Task**: Show match with confidence score and reason
- **Effort**: 1 hour

---

## Phase 4: Image Upload to Cloud

### 4.1 Setup Digital Ocean Spaces
- **Task**: Configure S3-compatible storage
- **Env vars**: `DO_SPACES_KEY`, `DO_SPACES_SECRET`, `DO_SPACES_BUCKET`
- **Effort**: 1 hour

### 4.2 Backend Upload Endpoint
- **File**: `server/src/routes/upload.ts`
- **Task**: Multer + S3 upload, return URL
- **Effort**: 2 hours

### 4.3 Frontend Upload Integration
- **File**: `components/CreatePost.tsx`
- **Task**: Upload file, get URL, store URL in post
- **Effort**: 1 hour

---

## Phase 5: Security Hardening

### 5.1 Rate Limiting
- **File**: `server/src/index.ts`
- **Task**: Add express-rate-limit middleware
- **Effort**: 30 min

### 5.2 Input Sanitization
- **File**: `server/src/routes/posts.ts`
- **Task**: Sanitize HTML in text fields
- **Effort**: 1 hour

### 5.3 HTTPS Redirect
- **File**: `server/src/index.ts`
- **Task**: Force HTTPS in production
- **Effort**: 15 min

---

## Phase 6: User Experience

### 6.1 My Posts Page
- **Task**: Show user's own posts with edit/delete actions
- **Effort**: 2 hours

### 6.2 Post Status Toggle
- **Task**: Mark post as RESOLVED when pet found
- **Effort**: 1 hour

### 6.3 Contact Reveal
- **Task**: Hide contact info until user clicks "Show contact"
- **Effort**: 1 hour

---

## Phase 7: Notifications (Future)

### 7.1 Email Notifications
- **Task**: Send email when match found
- **Dependency**: Email service (SendGrid/Mailgun)

### 7.2 Push Notifications
- **Task**: Browser push for new matches
- **Dependency**: Service worker setup

---

## Implementation Order

```
Week 1: Phase 1 (Critical UI) + Phase 2.3 (Delete)
Week 2: Phase 2.1-2.2 (Edit) + Phase 3 (Matches)
Week 3: Phase 4 (Image Upload)
Week 4: Phase 5 (Security) + Phase 6 (UX)
Future: Phase 7 (Notifications)
```

---

## Environment Variables Checklist

### Backend (server/.env)
- [ ] `DATABASE_URL` - PostgreSQL connection
- [ ] `JWT_SECRET` - Strong random string (32+ chars)
- [ ] `YANDEX_CLIENT_ID` - From oauth.yandex.ru
- [ ] `YANDEX_CLIENT_SECRET` - From oauth.yandex.ru
- [ ] `YANDEX_REDIRECT_URI` - Production callback URL
- [ ] `FRONTEND_URL` - Production frontend URL
- [ ] `CORS_ORIGIN` - Production frontend URL

### Frontend (.env)
- [ ] `VITE_YANDEX_MAPS_API_KEY` - From developer.tech.yandex.ru
- [ ] `VITE_API_URL` - Production API URL (optional if same domain)

---

## Quick Wins (Can do today)

1. Fix Yandex login button icon (15 min)
2. Add map to post detail modal (1-2 hours)
3. Add delete button for own posts (1 hour)

**Total for MVP improvements: ~3-4 hours**
