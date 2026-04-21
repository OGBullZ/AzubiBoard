# Typography & Spacing Updates - Specific Examples

## 1. Section Headers (fontSize: 11 → 13)

**Before:**
```jsx
<span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: 1 }}>
```

**After:**
```jsx
<span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
```

---

## 2. Task/Project Card Titles (fontSize: 13 → 16)

**Before (Line 318):**
```jsx
<div style={{ fontSize: 13, fontWeight: 700, color: C.br, lineHeight: 1.35, wordBreak: 'break-word', marginBottom: 5 }}>
```

**After (Line 318):**
```jsx
<div style={{ fontSize: 16, fontWeight: 700, color: C.br, lineHeight: 1.35, wordBreak: 'break-word', marginBottom: 5 }}>
```

---

## 3. Card Body Text (fontSize: 11 → 14)

**Before (Line 131):**
```jsx
<div style={{ fontSize: 11, color: C.mu, textAlign: 'center', lineHeight: 1.6 }}>
Keine offenen oder überfälligen Aufgaben
</div>
```

**After (Line 131):**
```jsx
<div style={{ fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 1.6 }}>
Keine offenen oder überfälligen Aufgaben
</div>
```

---

## 4. Card Padding (padding: '14px' → '20px')

**Before (Line 128):**
```jsx
<div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 16px', borderRadius: 10, ...}}>
```

**After (Line 128):**
```jsx
<div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px 16px', borderRadius: 10, ...}}>
```

---

## 5. Table Cell Padding (padding: '9px 12px' → '12px 14px')

**Before:**
```jsx
<td style={{ padding: '9px 12px', whiteSpace: 'nowrap', fontFamily: C.mono, fontSize: 11, ...}}>
```

**After:**
```jsx
<td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontFamily: C.mono, fontSize: 11, ...}}>
```

---

## 6. Color Variables (C.mu → C.textSecondary, C.tx → C.textPrimary)

**Before:**
```jsx
<span style={{ fontSize: 11, color: C.mu, fontWeight: 600 }}>{task.projectTitle}</span>
<span style={{ fontSize: 11, color: C.tx, flex: 1, ...}}>
```

**After:**
```jsx
<span style={{ fontSize: 11, color: C.textSecondary, fontWeight: 600 }}>{task.projectTitle}</span>
<span style={{ fontSize: 14, color: C.textPrimary, flex: 1, ...}}>
```

---

## Visual Impact

### Typography Hierarchy
- **Titles**: 16px (was 13px) - 23% larger
- **Body Text**: 14px (was 11/12px) - 17-27% larger
- **Section Headers**: 13px (was 10/11px) - 18-30% larger
- **Captions**: 10px (unchanged) - for small metadata

### Spacing Improvements
- **Main Cards**: 20px padding (was 14px) - 43% more generous
- **Table Cells**: 12px/14px padding (was 9px) - 33-56% more spacious
- **Overall visual breathing room**: Significantly improved

---

## Replacements Summary by Category

| Category | Count | Change |
|----------|-------|--------|
| Card Titles | 9 | fontSize: 13→16 |
| Body Text | 10 | fontSize: 11→14 |
| Descriptions | 9 | fontSize: 12→14 |
| Section Headers | 3 | fontSize: 10→13 |
| Main Card Padding | 9 | padding: 14px→20px |
| Table Cell Padding | 7 | padding: 9px→12px/14px |
| Color Variables (Primary) | 2 | C.tx→C.textPrimary |
| Color Variables (Secondary) | 49 | C.mu→C.textSecondary |
| **TOTAL** | **108** | |

