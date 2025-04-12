# Mastra スクレイピングエージェントプロジェクト

このプロジェクトは、Mastra AI エージェント開発フレームワークを使用して構築された Web スクレイピングエージェントのデモンストレーションです。基本的な天気エージェントと、ログイン処理や PDF としてのコンテンツ保存が可能な、より複雑なスクレイピングエージェントが含まれています。

## プロジェクト構造

-   `src/`: メインのソースコードが含まれます。
    -   `index.ts`: アプリケーションを実行し、コマンドライン経由でエージェントと対話するためのメインエントリポイント。
    -   `mastra/`: Mastra 固有の設定、エージェント、ツール。
        -   `index.ts`: 利用可能なエージェントを登録する Mastra インスタンスの設定。
        -   `agents/`: エージェント定義が含まれます。
            -   `weather-agent.ts`: 天気情報を取得するためのシンプルなエージェント（モックツールを使用）。
            -   `scraping-agent.ts`: Playwright を使用して深度に基づいて Web サイトをスクレイピングするエージェント。
            -   `range-scraping-agent.ts`: ID に基づいて URL 範囲をスクレイピングすることに特化したエージェント。
        -   `tools/`: エージェントが使用するツール定義が含まれます。
            -   `weather-tool.ts`: 天気データを提供するモックツール。
            -   `playwright-scrape-tool.ts`: Playwright を使用して深度ベースの Web スクレイピングと PDF 生成を行うツール。
            -   `playwright_scrape_range_tool.ts`: Playwright を使用して URL 範囲をスクレイピングし、PDF として保存するツール。
-   `package.json`: プロジェクトの依存関係とスクリプト。
-   `tsconfig.json`: TypeScript の設定。
-   `.env`: 環境変数（`GOOGLE_GENERATIVE_AI_API_KEY` が必要）。
-   `scraped_pdfs/`: スクレイピングエージェントによって生成された PDF のデフォルト出力ディレクトリ（自動的に作成されます）。

## セットアップ

1.  **リポジトリをクローンします（該当する場合）。**
2.  **依存関係をインストールします:**
    ```bash
    pnpm install
    ```
3.  **Playwright ブラウザと依存関係をインストールします:**
    ```bash
    pnpm exec playwright install --with-deps
    # 上記コマンドでシステムの依存関係が不足していると表示された場合、以下を実行します:
    # sudo apt-get update && sudo apt-get install -y libgles2 gstreamer1.0-libav
    ```
4.  プロジェクトルートに **`.env` ファイルを作成**し、Google Gemini API キーを追加します:
    ```env
    GOOGLE_GENERATIVE_AI_API_KEY=YOUR_GEMINI_API_KEY
    ```

## アプリケーションの実行

1.  **アプリケーションを開始します:**
    ```bash
    pnpm start
    ```
2.  アプリケーションは、エージェント（`weatherAgent`、`scrapingAgent`、または `rangeScrapingAgent`）を選択するように促します。
3.  対話したいエージェントの名前を入力します（例: `rangeScrapingAgent`）。
4.  リクエストを入力して、選択したエージェントと対話します。
5.  セッション中にエージェントを変更するには、`switch <agent_name>`（例: `switch weatherAgent` または `switch rangeScrapingAgent`）と入力します。
6.  アプリケーションを終了するには `exit` と入力します。


## 範囲スクレイピングエージェント (`rangeScrapingAgent`) の使用

このエージェントは、URL 内の ID パターン（例: 記事、投稿、雑誌）に基づいて一連のページをスクレイピングすることに特化しています。

**機能:**

-   `{id}` プレースホルダーを含むベース URL パターンを受け取ります。
-   開始 ID と終了 ID を受け取ります。
-   指定された範囲内のすべての ID を反復処理し、それぞれについて完全な URL を構築します。
-   範囲スクレイピングを開始する前に、提供された認証情報と CSS セレクターを使用してオプションでログインを処理します。
-   正常にスクレイピングされた各ページを、その ID で名前が付けられた PDF ファイルとして保存します。
-   オプションで各ページの CAPTCHA 要素をチェックし、見つかった場合はスキップします。
-   PDF をホスト名と特定のフォルダ（例: `magazines`）にちなんで名付けられたサブディレクトリに保存します。

**対話方法:**

1.  アプリケーションを開始し（`pnpm start`）、`rangeScrapingAgent` を選択します。
2.  ベース URL パターン、開始 ID、終了 ID を指定してリクエストを行います。例:
    `scrape range from https://example.com/article/{id} starting at 100 ending at 200`
3.  エージェントはパラメータを確認するように求めます:
    -   ベース URL パターン
    -   開始 ID
    -   終了 ID
    -   ログインが必要かどうか。
4.  **ログインが必要な場合**、エージェントは以下を要求します:
    -   ログインページ URL（オプション、範囲内の最初の URL がデフォルト）
    -   ユーザー名
    -   パスワード
    -   ユーザー名フィールドの CSS セレクター
    -   パスワードフィールドの CSS セレクター
    -   ログインボタンの CSS セレクター
    -   （オプション）CAPTCHA チェック用の CSS セレクター
5.  プロンプトが表示されたら、必要な詳細を提供します。
6.  `yes` と入力して最終パラメータを確認します。
7.  エージェントは Playwright を使用してスクレイピングプロセスを実行します。PDF はデフォルトで `scraped_pdfs/<hostname>/magazines/` のようなサブディレクトリに保存されます。


## スクレイピングエージェント (`scrapingAgent`) の使用

`scrapingAgent` は `playwright_scrape_website` ツールを使用して Web ページをスクレイピングします。

**機能:**

-   開始 URL に移動します。
-   オプションで、提供された認証情報と CSS セレクターを使用してログインを処理します。
-   同じドメイン内のリンクをたどり、指定された深度までページをスクレイピングします。
-   スクレイピングされた各ページを PDF ファイルとして保存します。
-   出力フォルダ内に Web サイトのディレクトリ構造を保持します。

**対話方法:**

1.  アプリケーションを開始し（`pnpm start`）、`scrapingAgent` を選択します。
2.  ターゲット URL と希望する深度を指定してリクエストを行います。例:
    `scrape https://example.com with depth 1`
3.  エージェントはパラメータを確認するように求めます:
    -   開始 URL
    -   スクレイピング深度
    -   ログインが必要かどうか。
4.  **ログインが必要な場合**、エージェントは以下を要求します:
    -   ログインページ URL（開始 URL と異なる場合）
    -   ユーザー名
    -   パスワード
    -   ユーザー名フィールドの CSS セレクター
    -   パスワードフィールドの CSS セレクター
    -   ログインボタンの CSS セレクター
    -   （オプション）CAPTCHA チェック用の CSS セレクター（例: `iframe[title*="captcha"]`）
5.  プロンプトが表示されたら、必要な詳細を提供します。
6.  `yes` と入力して最終パラメータを確認します。
7.  エージェントは Playwright を使用してスクレイピングプロセスを実行します。PDF はデフォルトで `scraped_pdfs/<hostname>/` ディレクトリ（またはツール入力で指定されたディレクトリ）に保存されます。

**ログイン対話の例:**

```
> scrape https://internalsite.example.com/dashboard with depth 0, it requires login

scrapingAgent: はい、お手伝いできます。ログインが必要な https://internalsite.example.com/dashboard をスクレイピングするには、もう少し詳細が必要です:

1.  **ログインページ URL:** (開始 URL と同じですか、それとも異なりますか？)
2.  **ユーザー名:**
3.  **パスワード:**
4.  **ユーザー名フィールドの CSS セレクター:** (例: #username)
5.  **パスワードフィールドの CSS セレクター:** (例: #password)
6.  **ログインボタンの CSS セレクター:** (例: button[type='submit'])

これらの詳細を提供してください。

> Login URL is https://internalsite.example.com/login, user is admin, pass is pa$$w0rd, user selector is #user, pass selector is #pass, button is .login-btn

scrapingAgent: 承知しました。スクレイピングを開始する前に、以下を確認してください:

1.  **開始 URL:** https://internalsite.example.com/dashboard
2.  **スクレイピング深度:** 0
3.  **ログインが必要:** はい
4.  **ログイン詳細:**
    *   ログイン URL: https://internalsite.example.com/login
    *   ユーザー名: admin
    *   パスワード: [提供済み]
    *   ユーザー名セレクター: #user
    *   パスワードセレクター: #pass
    *   ログインボタンセレクター: .login-btn
    *   CAPTCHA セレクター: (オプション、例: #captcha-element)

これが正しければ、「yes」と入力してください。

> yes

Thinking... (using scrapingAgent)
Attempting login at: https://internalsite.example.com/login
Login attempted.
Scraping [Depth 0]: https://internalsite.example.com/dashboard
Saved PDF: /home/ubuntu/scraped_pdfs/internalsite.example.com/dashboard.pdf

scrapingAgent: https://internalsite.example.com/dashboard のスクレイピングが完了しました。PDF は /home/ubuntu/scraped_pdfs/internalsite.example.com/ に保存されています。
```
