# 日程ぴたパズル v1.0.6

## 起動

```bash
npm install
npm run dev
```

## v1.0.6 変更点

- 予定テキストから日付を抽出して、選択した日を❌にする機能を追加
- `7/1`, `7月1日`, `7月 1日 3日`, `20, 21, 22 NG` などに対応
- カレンダー外枠はみ出し防止
- 日付処理をローカル日付ベースに固定

## Supabase設定

`.env.local.example` を `.env.local` にコピーして、Project URL と Publishable key を貼ってください。
Secret key は入れないでください。
