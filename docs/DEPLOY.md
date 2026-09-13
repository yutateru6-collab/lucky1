# GitHub・Cloudflareへの反映

## 現在の状態

ソースの保存先は `yutateru6-collab/lucky1` です。Cloudflareへの公開は未実施です。アプリ名は `lucky`、Cloudflare Workersのプロジェクト名は `lucky1` です。

## 1. GitHub

リポジトリ: https://github.com/yutateru6-collab/lucky1

`main` にアプリ一式を配置します。

既存ファイルがある場合は、先に取得して差分を確認してください。無関係なファイルを削除したり、強制pushで上書きしたりしないでください。

このパッケージを配置するときは、`public/` と `package.json` がリポジトリ直下に来るようにします。`lucky1/lucky/public/` のように二重の階層を作らないでください。

GitHubへのアクセス許可の公式説明：
https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps

## 2A. Cloudflare Workers Static Assets

初版にサーバー処理やデータベースは不要です。静的ファイルを公開します。

`wrangler.jsonc`：

```json
{
  "name": "lucky1",
  "compatibility_date": "2026-09-13",
  "assets": { "directory": "./public" },
  "workers_dev": true
}
```

CLIから：

```sh
npx wrangler@4 login
npm run check
npm run deploy
```

実際にログインしたアカウントの `lucky1` Workerへ反映します。同名の既存Workerがある場合は、上書きしてよいかを先に確認してください。APIトークンをソースコードやチャットに書かないでください。

GitHub連携のWorkers Buildsを使う場合は、コードを入れたブランチを選び、ビルドコマンドを `npm run check`、デプロイコマンドを `npx wrangler@4 deploy` とします。アカウントによって表示される画面や既定値は異なる可能性があります。

静的ファイル設定の公式説明：
https://developers.cloudflare.com/workers/static-assets/binding/
https://developers.cloudflare.com/workers/static-assets/

## 2B. Cloudflare Pages（代替）

PagesとしてGitHubリポジトリを接続する場合：

| 項目 | 設定 |
| --- | --- |
| Framework preset | None |
| Production branch | コードを入れた実際のブランチ。通常は main |
| Build command | `exit 0` |
| Build output directory | `public` |

この方式ではWorkers用の `wrangler.jsonc` をデプロイ設定に使う必要はありません。公開対象は `public/` です。ディレクトリのアップロード方式を使う場合も、公開対象の直下に `index.html` がある状態にします。

公式説明：
https://developers.cloudflare.com/pages/framework-guides/deploy-anything/

## 公開後に確認すること

- 実際に発行されたHTTPSのURLを開き、「やる」「やらない」の両方が動くこと。
- 結果と反対の選択や「まだ決めない」ができること。
- 記録を保存して再読み込みし、残っていること。
- 保存データの削除ができること。
- iPhoneのSafari・Android・PCで、ボタンや文字が隠れないこと。
- 初回オンラインでの読み込み後、Service Workerが有効化された状態でオフライン再読み込みができること。
- PWA追加とキャッシュ更新が正しく働くこと。

公開URLは成功したデプロイ結果から取得してください。`lucky1.pages.dev` などのURLが使えるとは事前に断定できません。
