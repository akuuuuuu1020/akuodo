//=============================================================================
// aquariumLocalize.js
// ----------------------------------------------------------------------------
// Version
// 1.7.2 : 2025/04/24 エンディングクレジット処理を微変更しました
// 1.7.1 : 2025/03/03 エンディングクレジット処理を微変更しました
// 1.7.0 : 2025/02/26 文字入力画面で日本語以外の場合に処理を追加しました
// 1.6.0 : 2025/02/22 エンディングクレジットの一部を多言語対応しました
// 1.5.2 : 2025/02/20 選択肢ウィンドウの横幅を言語によって調節するように修正しました
// 1.5.1 : 2025/02/18 表情変更の不具合を修正しました
// 1.5.0 : 2025/02/12 一部のピクチャと遠景を多言語対応しました
// 1.4.1 : 2025/02/07 オプションでの言語切り替えのバグを修正しました
// 1.4.0 : 2025/02/06 ボイスの停止処理を追加しました
//                    テストプレイ中はアナザーニューゲームフラグをマップIDで立てるようにしました
// 1.3.0 : 2025/01/25 csvによる強制立ち絵位置変更機能を追加
//                    csvの列数が変更されました
// 1.2.0 : 2025/01/23 言語が増えても問題がないように修正
//                    アナザーニューゲーム中の立ち絵表示処理・自動消去処理を変更
//                    立ち絵表示プラグインコマンドに表情先読み機能を追加
//                    メニュー画面のステータスのアクター名が言語別になるよう修正
// 1.1.0 : 2025/01/04 立ち絵の表示処理変更、名前入力ウィンドウの初期表示言語変更
// 1.0.0 : 2024/12/20 初版
//=============================================================================

/*:
 * @target MZ
 * @plugindesc ローカライズプラグイン
 * @author Kohei
 * @version 1.7.2
 * 
 * @help
 * アクアリウムは踊らない専用プラグインです。
 * csvデータを元にゲーム中に言語切り替えを行い、
 * ボイス再生・立ち絵表示を行います。
 * 
 * @//////////// Plugin Parameter ////////////////////////////////////////////////////////////
 * 
 * @param voiceStop
 * @text メッセージ送りでボイス停止
 * @desc 次にキャラクターのセリフがなくても、メッセージ送りでボイスを停止するか設定します。ONで停止します。
 * @default true
 * @type boolean
 * 
 */

(() => {
    const pluginParams = PluginManager.parameters(document.currentScript.src.split("/").pop().replace(/\.js$/, ""));
    const paramVoiceStop = pluginParams["voiceStop"] == "true" || false;

    ////////////////////////////////////////////////////////////////////////////////////////
    //  翻訳データ管理クラス
    ////////////////////////////////////////////////////////////////////////////////////////

    class Localize {
        #textData;
        #languageData = {
            jp: "日本語", en: "English", kr: "한국어", kn: "簡体字", hn: "繁体字"
        };
        #languageKeyList;
        #skitNameData = {
            スーズ: "suze", アイナ: "aina", レトロ: "retro", ルル: "ruru",
            クリス: "chris", キティ: "kitty", トイ: "toi"
        };
        #languagePictureData = [
            "daidai", "ED1", "ED2", "ED3", "ED4", "ED5", "ED5_2",
            "jikkyou_ok01", "jikkyou_ok02", "mail9", "warning_01blue",
            "origami"
        ];
        #languageParallaxData = ["mail9", "another1", "another2"];
        #skitValueList;
        #skitKeyList;
        constructor() {
            this.init();
        };

        // 初期宣言
        init() {
            this.#languageKeyList = Object.keys(this.#languageData);
            this.#skitValueList = Object.values(this.#skitNameData);
            this.#skitKeyList = Object.keys(this.#skitNameData);
            this.#textData = this.CSVtoData();
        };

        // フォント変更
        changeFont() {
            const language = ConfigManager.language;
            let fileName = "";
            switch (language) {
                case "kr":
                    fileName = "neodgm_code.ttf";
                    break;
                case "kn": case "hn":
                    fileName = "WenQuanYiBitmapSong.woff";
                    break;
                default:
                    fileName = "KH-Dot-Akihabara-16.ttf";
                    break;
            }
            FontManager._states["rmmz-mainfont"] = null;
            FontManager.load("rmmz-mainfont", fileName);
        };

        // CSVをオブジェクトとして格納する
        CSVtoData() {
            let csvData;
            if (Utils.isNwjs()) {
                csvData = require("fs").readFileSync("./dataEx/textData.csv", "utf8");
            } else {
                const xhr = new XMLHttpRequest();
                xhr.open("GET", "./dataEx/textData.csv", false);
                xhr.overrideMimeType("text/plain; charset=utf-8");
                xhr.send();
                if (xhr.status < 200 || xhr.status >= 300) {
                    throw new Error(`Failed to load ./dataEx/textData.csv (${xhr.status})`);
                }
                csvData = xhr.responseText;
            }
            const lines = csvData.split("\n");
            const textData = {};
            const languageKeyList = this.#languageKeyList;
            const languageLength = languageKeyList.length;
            const languageColumnStart = 7;
            let lastId = null;

            const length = lines.length;
            for (let i = 1; i < length; i++) {
                const line = lines[i].trim();
                if (!line) { continue };

                const fields = this.parseCSVLine(line);
                const id = fields[0];
                const voiceId = fields[1];
                const faceId = fields[2];
                const skitPosition = fields[3];
                // [4] [5] は不要データのため使用しない
                const character = fields[6];

                // idがある場合、新しいオブジェクトを作成
                if (id) {
                    textData[id] = {
                        voiceId: voiceId || "",
                        faceId: faceId || "",
                        skitPosition: skitPosition || "",
                        character: character || ""
                    };
                    // 各言語のテキストを格納
                    for (let i = 0; i < languageLength; i++) {
                        const languageKey = languageKeyList[i];
                        const languageText = fields[i + languageColumnStart];
                        textData[id][languageKey] = languageText || "";
                    }
                    lastId = id;
                    continue;
                }
                // idが空の場合、前の行の各言語に\nを追加
                if (lastId) {
                    for (let i = 0; i < languageLength; i++) {
                        const languageKey = languageKeyList[i];
                        const languageText = fields[i + languageColumnStart];
                        textData[lastId][languageKey] += languageText
                            ? "\n" + languageText
                            : "";
                    }
                }
            }

            return textData;
        };

        // CSVの1行を正しくパースする関数
        parseCSVLine(line) {
            const result = [];
            let current = "";
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                // 連続した二重引用符はエスケープされた引用符とみなす
                if (char === '"' && line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                    continue;
                }
                // 引用符の開始または終了を検知
                if (char === '"') {
                    inQuotes = !inQuotes;
                    continue;
                }
                // カンマ区切り（引用符の外の場合のみ）
                if (char === "," && !inQuotes) {
                    result.push(current);
                    current = "";
                    continue;
                }
                // 通常の文字
                current += char;
            }

            result.push(current);
            return result;
        };

        // 短縮言語から言語フルネームを取得
        getLanguageText(key) {
            return this.#languageData[key];
        };

        // 次の言語を取得
        getNextLanguage() {
            const language = ConfigManager.language;
            const index = this.#languageKeyList.indexOf(language);
            const nextIndex = (index + 1) % this.#languageKeyList.length;
            return this.#languageKeyList[nextIndex];
        };

        // 前の言語を取得
        getBackLanguage() {
            const language = ConfigManager.language;
            const index = this.#languageKeyList.indexOf(language);
            const backIndex = index - 1 < 0
                ? this.#languageKeyList.length - 1
                : index - 1;
            return this.#languageKeyList[backIndex];
        };

        // 変換したデータを取得
        getTextDataBase() {
            return this.#textData;
        };

        // IDで現言語のテキストデータを取得
        getTextData(id) {
            const data = this.#textData[id];
            if (!data) { return null; }
            const language = ConfigManager.language;
            const name = data.character != ""
                ? this.getName(data.character)
                : "";
            const skitName = this.getSkitName(data.character);
            return {
                text: data[language], name: name, voiceId: data.voiceId,
                faceId: data.faceId, skitPosition: data.skitPosition, skitName: skitName
            };
        };

        // 言語別キャラクター名を取得
        getName(name) {
            const data = this.#textData["name_" + name];
            if (!data) { return "Error! csvに名前データがありません"; }
            const language = ConfigManager.language;
            return data[language];
        };

        // 立ち絵プラグインの表情変更先の参照用
        getSkitName(name) {
            return this.#skitNameData[name];
        };

        // 立ち絵表情リストの要素配列
        getSkitValueList() {
            return this.#skitValueList;
        };

        // 立ち絵表情リストのキー配列
        getSkitKeyList() {
            return this.#skitKeyList;
        };

        // 名前入力ギミックの対応
        nameInputGimmick(answer) {
            const language = ConfigManager.language;
            const inputActorName = $gameActors.actor(6).name();
            switch (answer) {
                case "マグロ":
                    if ((language == "jp" && inputActorName == "マグロ") ||
                        (language != "jp" && inputActorName == "ＴＵＮＡ")) {
                        return true;
                    }
                    break;
                case "ホウボウ":
                    if ((language == "jp" && inputActorName == "ホウボウ") ||
                        (language != "jp" && inputActorName == "ＦＩＲＥＧＯＢＹ")) {
                        return true;
                    }
                    break;
                case "クリス":
                    if ((language == "jp" && inputActorName == "クリス") ||
                        (language != "jp" && (inputActorName == "ＣＨＲＩＳＳＹ" || inputActorName == "ＣＨＲＩＳ"))) {
                        return true;
                    }
                    break;
            }
            return false;
        };

        // エンディングのカテゴリ表記を変数にセット
        setEndingCategory() {
            for (let i = 1; i < 19; i++) {
                // 変数41 ～ 58 にエンディングカテゴリをセット
                const variableId = 40 + i;
                const textData = this.getTextData("credit_" + i);
                $gameVariables._data[variableId] = textData.text;
            }
        };

        // ピクチャリスト取得
        getPictureList() {
            return this.#languagePictureData;
        };

        // 遠景リスト取得
        getParallaxList() {
            return this.#languageParallaxData;
        };

        // アナザーニューゲーム中フラグのセット
        setAnotherNewGameMode(bool) {
            // $gameSystemは、セーブデータに保存されるデータなので
            // アナザーニューゲームのセーブデータをロードしても判定が残るようにする
            $gameSystem.anotherNewGameMode = bool;
        };

        // アナザーニューゲーム中か判定
        isAnotherNewGameMode() {
            return $gameSystem.anotherNewGameMode;
        };

        // テストプレイ中はアナザーニューゲームフラグをマップIDで設定（初期位置を変えた場合の対策）
        // unity移植の際は不要です
        setAnotherNewGameModeTestPlay(mapId) {
            if ($gameTemp.isPlaytest() && mapId >= 193) {
                this.setAnotherNewGameMode(true);
            }
        };

        // デバッグ用、リストをコンソールに
        debug() {
            console.log(this.#textData);
        };
    }

    // グローバル化
    $aquaLocalize = new Localize();

    ////////////////////////////////////////////////////////////////////////////////////////
    //  マップIDでアナザーニューゲーム中か判定
    ////////////////////////////////////////////////////////////////////////////////////////

    // unity移植の際は不要です
    const Game_Map_prototype_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function (mapId) {
        Game_Map_prototype_setup.apply(this, arguments);
        $aquaLocalize.setAnotherNewGameModeTestPlay(mapId);
    };

    ////////////////////////////////////////////////////////////////////////////////////////
    //  コンフィグに言語変更追加
    ////////////////////////////////////////////////////////////////////////////////////////

    ConfigManager.language = "jp";

    const ConfigManager_makeData = ConfigManager.makeData;
    ConfigManager.makeData = function () {
        const config = ConfigManager_makeData.apply(this, arguments);
        config.language = this.language;
        return config;
    };

    const ConfigManager_applyData = ConfigManager.applyData;
    ConfigManager.applyData = function (config) {
        ConfigManager_applyData.apply(this, arguments);
        this.language = this.readValue(config, "language", "jp");
    };

    ConfigManager.readValue = function (config, name, defaultValue) {
        if (name in config) {
            return config[name];
        } else {
            return defaultValue;
        }
    };

    const ConfigManager_load = ConfigManager.load;
    ConfigManager.load = function () {
        ConfigManager_load.apply(this, arguments);
        this.changeFontLoaded();
    };

    // コンフィグがロード完了するまで待機してからフォント変更
    ConfigManager.changeFontLoaded = async function () {
        while (!this._isLoaded) {
            // ロード完了してなかったら1フレーム待機
            await new Promise(resolve => setTimeout(resolve, 16.7));
        }
        $aquaLocalize.changeFont();
    };

    ////////////////////////////////////////////////////////////////////////////////////////
    //  オプションに言語変更追加
    ////////////////////////////////////////////////////////////////////////////////////////

    Window_Options.prototype.addGeneralOptions = function () {
        this.addCommand("Language", "language");
        this.addCommand(TextManager.alwaysDash, "alwaysDash");
    };

    Window_Options.prototype.statusText = function (index) {
        const symbol = this.commandSymbol(index);
        const value = this.getConfigValue(symbol);
        if (this.isVolumeSymbol(symbol)) {
            return this.volumeStatusText(value);
        } else if (symbol == "language") {
            return $aquaLocalize.getLanguageText(value);
        }
        return this.booleanStatusText(value);
    };

    Window_Options.prototype.processOk = function () {
        const index = this.index();
        const symbol = this.commandSymbol(index);
        if (this.isVolumeSymbol(symbol)) {
            this.changeVolume(symbol, true, true);
            return;
        }
        const value = symbol == "language" || !this.getConfigValue(symbol);
        this.changeValue(symbol, value);
    };

    const Window_Options_prototype_changeValue = Window_Options.prototype.changeValue;
    Window_Options.prototype.changeValue = function (symbol, value) {
        if (symbol == "language") {
            this.changeLanguage(symbol, value);
            this.refreshFontLoaded();
            return;
        }
        Window_Options_prototype_changeValue.apply(this, arguments);
    };

    Window_Options.prototype.changeLanguage = function (symbol, rightward) {
        rightward
            ? ConfigManager.language = $aquaLocalize.getNextLanguage()
            : ConfigManager.language = $aquaLocalize.getBackLanguage();
        $aquaLocalize.changeFont();
        this.redrawItem(this.findSymbol(symbol));
        this.playCursorSound();
    };

    // フォントのロードが終わるまで待機してからウィンドウ内描画を更新
    Window_Options.prototype.refreshFontLoaded = async function () {
        while (!FontManager.isReady()) {
            // ロード完了してなかったら1フレーム待機
            await new Promise(resolve => setTimeout(resolve, 16.7));
        }
        this.refresh();
    };

    ////////////////////////////////////////////////////////////////////////////////////////
    //  名前入力を言語に合わせて初期表示変更
    ////////////////////////////////////////////////////////////////////////////////////////

    Window_NameInput.prototype.table = function () {
        const language = ConfigManager.language;
        const okIndex = 89;
        if (language == "jp") {
            const text = "決定";
            Window_NameInput.JAPAN1[okIndex] = text;
            Window_NameInput.JAPAN2[okIndex] = text;
            Window_NameInput.JAPAN3[okIndex] = text;
            return [Window_NameInput.JAPAN1, Window_NameInput.JAPAN2, Window_NameInput.JAPAN3];
        }
        const text = "OK";
        Window_NameInput.JAPAN1[okIndex] = text;
        Window_NameInput.JAPAN2[okIndex] = text;
        Window_NameInput.JAPAN3[okIndex] = text;
        return [Window_NameInput.JAPAN3, Window_NameInput.JAPAN1, Window_NameInput.JAPAN2];
    };

    ////////////////////////////////////////////////////////////////////////////////////////
    //  コマンド追加時に言語別にする
    ////////////////////////////////////////////////////////////////////////////////////////

    // コマンド追加
    const Window_Command_prototype_addCommand = Window_Command.prototype.addCommand;
    Window_Command.prototype.addCommand = function (name, symbol, enabled = true, ext = null) {
        const textData = $aquaLocalize.getTextData("system_" + name);
        if (textData) {
            this._list.push({ name: textData.text, symbol: symbol, enabled: enabled, ext: ext });
            return;
        }
        Window_Command_prototype_addCommand.apply(this, arguments);
    };

    ////////////////////////////////////////////////////////////////////////////////////////
    //  アイテム表示を言語別にする
    ////////////////////////////////////////////////////////////////////////////////////////

    // アイテム名の表示
    const Window_Base_prototype_drawItemName = Window_Base.prototype.drawItemName;
    Window_Base.prototype.drawItemName = function (item, x, y, width) {
        const textData = $aquaLocalize.getTextData("item_" + item.name);
        if (textData) {
            const iconY = y + (this.lineHeight() - ImageManager.iconHeight) / 2;
            const textMargin = ImageManager.iconWidth + 4;
            const itemWidth = Math.max(0, width - textMargin);
            this.resetTextColor();
            this.drawIcon(item.iconIndex, x, iconY);
            this.drawText(textData.text, x + textMargin, y, itemWidth);
            return;
        }
        Window_Base_prototype_drawItemName.apply(this, arguments);
    };

    // ヘルプウィンドウの内容表示
    Window_ItemList.prototype.setHelpWindowItem = function (item) {
        if (item) {
            const textData = $aquaLocalize.getTextData("itemTips_" + item.name);
            if (textData) {
                const newItem = { name: item.name, description: textData.text };
                this._helpWindow.setItem(newItem);
                return;
            }
        }
    };

    // イベントコマンドのアイテム選択リストも上書き
    Window_EventItem.prototype.setHelpWindowItem = Window_ItemList.prototype.setHelpWindowItem;

    ////////////////////////////////////////////////////////////////////////////////////////
    //  メニュー画面のステータスのアクター名を言語別にする
    ////////////////////////////////////////////////////////////////////////////////////////

    Window_StatusBase.prototype.drawActorName = function (actor, x, y, width) {
        width = width || 168;
        this.changeTextColor(ColorManager.hpColor(actor));
        const acterName = actor.name();
        const nameText = $aquaLocalize.getName(acterName);
        this.drawText(nameText || acterName, x, y, width);
    };

    ////////////////////////////////////////////////////////////////////////////////////////
    //  セーブロード画面を言語別にする
    ////////////////////////////////////////////////////////////////////////////////////////

    // ファイル表示
    Window_SavefileList.prototype.drawTitle = function (savefileId, x, y) {
        if (savefileId === 0) {
            const textData = $aquaLocalize.getTextData("system_" + TextManager.autosave);
            this.drawText(textData ? textData.text : TextManager.autosave, x, y, 180);
        } else {
            const textData = $aquaLocalize.getTextData("system_" + TextManager.file);
            const fileText = textData ? textData.text : TextManager.file;
            this.drawText(fileText + " " + savefileId, x, y, 180);
        }
    };

    // セーブ画面のヘルプウィンドウ内容表示
    Scene_Save.prototype.helpWindowText = function () {
        const textData = $aquaLocalize.getTextData("system_" + TextManager.saveMessage);
        return textData ? textData.text : TextManager.saveMessage;
    };

    // ロード画面のヘルプウィンドウ内容表示
    Scene_Load.prototype.helpWindowText = function () {
        const textData = $aquaLocalize.getTextData("system_" + TextManager.loadMessage);
        return textData ? textData.text : TextManager.loadMessage;
    };

    ////////////////////////////////////////////////////////////////////////////////////////
    //  選択肢を言語別にする
    ////////////////////////////////////////////////////////////////////////////////////////

    Window_ChoiceList.prototype.makeCommandList = function () {
        const choices = $gameMessage.choices();
        for (const choice of choices) {
            const textData = $aquaLocalize.getTextData("choice_" + choice);
            this.addCommand(textData ? textData.text : choice, "choice");
        }
    };

    // 選択肢ウィンドウの横幅を言語によって調節
    Window_ChoiceList.prototype.maxChoiceWidth = function () {
        let maxWidth = 96;
        const choices = $gameMessage.choices();
        for (const choice of choices) {
            const textData = $aquaLocalize.getTextData("choice_" + choice);
            const text = textData ? textData.text : choice;
            const textWidth = this.textSizeEx(text).width;
            const choiceWidth = Math.ceil(textWidth) + this.itemPadding() * 2;
            if (maxWidth < choiceWidth) {
                maxWidth = choiceWidth;
            }
        }
        return maxWidth;
    };

    ////////////////////////////////////////////////////////////////////////////////////////
    //  会話終了時にスキット自動消去
    ////////////////////////////////////////////////////////////////////////////////////////

    // 最後に実行されたコマンドを記憶するプロパティを追加
    const Game_Interpreter_prototype_setup = Game_Interpreter.prototype.setup;
    Game_Interpreter.prototype.setup = function (list, eventId) {
        Game_Interpreter_prototype_setup.apply(this, arguments);
        this.lastCommand = "";
    };

    // 次のコマンドがメッセージではないなら立ち絵終了予約
    const Game_Interpreter_prototype_executeCommand = Game_Interpreter.prototype.executeCommand;
    Game_Interpreter.prototype.executeCommand = function () {
        const command = this.currentCommand();
        if (command) {
            if (command.code != 101 && this.lastCommand == 101) {
                this.forceSkitEnd = { time: 2 };
            }
            this.lastCommand = command.code;
        }
        return Game_Interpreter_prototype_executeCommand.apply(this, arguments);
    };

    // 立ち絵自動消去予約の更新
    const Game_Interpreter_prototype_update = Game_Interpreter.prototype.update;
    Game_Interpreter.prototype.update = function () {
        this.updateForceSkitEnd();
        Game_Interpreter_prototype_update.apply(this, arguments);
    };

    // 予約から2フレーム経過後、メッセージコマンドが間に挟まれ予約解除されていなければ強制的にスキットを消去する
    // ※↓の Game_Interpreter.prototype.command101 の中で予約解除される
    // 意図：ウェイトの発生しないイベントコマンドや、キャラクターの向きだけを変える1フレームのコマンドが
    // メッセージの間に挟まってると立ち絵を消去しようとした後にすぐ表示しチラつくのを防止
    Game_Interpreter.prototype.updateForceSkitEnd = function () {
        // AnotherNewGameでは、スキット自動消去を無効化
        if ($aquaLocalize.isAnotherNewGameMode()) {
            return;
        }
        // 予約があればカウントダウンし、0になったらスキットを消去
        if (this.forceSkitEnd) {
            if (this.forceSkitEnd.time <= 0) {
                $gameSkit.end();
                this.forceSkitEnd = null;
                return;
            }
            this.forceSkitEnd.time -= 1;
        }
    };

    // スキット自動消去中はイベント発火させない
    Game_Message.prototype.isBusy = function () {
        return (
            this.hasText() ||
            this.isChoice() ||
            this.isNumberInput() ||
            this.isItemChoice() ||
            $gameSkit.isBusy()
        );
    };

    ////////////////////////////////////////////////////////////////////////////////////////
    //  言語別メッセージ表示
    ////////////////////////////////////////////////////////////////////////////////////////

    // メッセージに$LC[id]が含まれている場合、ローカライズテキストのID取得
    const getTextId = function (text) {
        let id = null;
        text.replace(/\$LC\[(.*?)\]/g, function () {
            id = arguments[1];
        }.bind(this));
        return id;
    };

    // \SE[n]のフェイスIDを取得
    const getSeFaceId = function (text) {
        const matchSE = text.match(/\\SE\[(.*?)\]/);
        return matchSE ? matchSE[1] : "";
    };

    // 言語別テキストに差し替える
    const Window_Base_prototype_convertEscapeCharacters = Window_Base.prototype.convertEscapeCharacters;
    Window_Base.prototype.convertEscapeCharacters = function (text) {
        const originalText = Window_Base_prototype_convertEscapeCharacters.apply(this, arguments);
        const id = getTextId(text);
        if (id) {
            const textData = $aquaLocalize.getTextData(id);
            // テキストデータがあれば言語別テキストに、なければ元のテキストを返す
            return textData ? this.originalConvertEscapeCharacters(textData.text) : originalText;
        }
        // 当てはまらなければ元の文章を返す
        return originalText;
    };

    // 上書き前のコアスクリプトの変換関数
    Window_Base.prototype.originalConvertEscapeCharacters = Window_Base_prototype_convertEscapeCharacters;

    // 立ち絵（顔グラ）、名前ボックス、ボイス
    const Game_Interpreter_prototype_command101 = Game_Interpreter.prototype.command101;
    Game_Interpreter.prototype.command101 = function (params) {
        // 立ち絵自動消去予約解除
        this.forceSkitEnd = null;
        // 元の処理内でthis._indexがインクリメントされるため、ここで次のコマンドを取得
        const firstTextLineCommand = this._list[this._index + 1];
        const text = firstTextLineCommand ? String(firstTextLineCommand.parameters[0]) : "";
        // 名前ボックスを上書きするために元の処理は予めやっておく
        const result = Game_Interpreter_prototype_command101.apply(this, arguments);
        // 最初の一行に$LC[n]があればローカライズテキストの処理
        const id = getTextId(text);
        if (firstTextLineCommand && id) {
            const textData = $aquaLocalize.getTextData(id);
            // テキストデータがなかったらなにもしない
            if (!textData) { return result; }
            // 名前ボックスを変更、空が入るなら名前ボックス非表示に
            $gameMessage.setSpeakerName(textData.name);
            // 立ち絵表示
            showSkitBranch(params, textData, text);
            // ボイス再生
            this.playVoice(textData.voiceId);
        }
        return result;
    };

    // 立ち絵プラグインから元に戻す (自動表示に使われていた)
    Game_Message.prototype.add = function (text) {
        this._texts.push(text);
    };

    // 立ち絵プラグインの処理を一部流用し、自動立ち絵表示
    const autoShowSkitActor = function (skitName, forcePosition) {
        const targetActor = $gameSkit.actor(skitName);
        if (!targetActor || targetActor._showing) {
            // すでに表示済みならフォーカス
            $gameSkit.focusSkitActor([null, skitName, false, true]);
            return;
        }
        // 立ち絵自動消去中だったら自動消去をキャンセル
        $gameSkit._waitAfterClear = false;

        const parameters = TRP_CORE.skitParameters;
        const positions = parameters.autoModePositions || ["left", "right"];
        const actors = $gameSkit.actors();
        const showCommand = parameters.defaultShowCommand;
        // 非表示済みのスキットを配列から消す
        const length = actors.length;
        for (var i = length - 1; i >= 0; i = (i - 1) | 0) {
            const actor = actors[i];
            if (!actor._showing) {
                actors.splice(i, 1);
            }
        }
        // 立ち絵の表示
        autoShowSkitBranch(actors, positions, skitName, targetActor, showCommand, forcePosition);
    };

    // 立ち絵表示処理の分岐
    const autoShowSkitBranch = function (actors, positions, skitName, targetActor, showCommand, forcePosition) {
        // アナザーニューゲーム中は従来の立ち絵プラグイン仕様にする
        if ($aquaLocalize.isAnotherNewGameMode()) {
            const position = $gameSkit._openPositionForAutoShow(actors, positions);
            // 同じ位置にいる立ち絵を非表示
            autoSkitHide(skitName, actors, position);
            targetActor.showWithMode(showCommand, true, position);
            return;
        }
        // アクターがいない、もしくは自分だけの場合
        const noSkit = actors.length == 0;
        const isMySkit = actors.length == 1 && actors[0] === targetActor;
        if (noSkit || isMySkit) {
            // csvによる強制立ち絵位置変更があればそれに、なければパーティの先頭キャラなのか判定
            const position = forcePosition
                ? forcePosition
                : isPartyHeadActor(skitName) ? "左" : "右";
            targetActor.showWithMode(showCommand, true, position);
            return;
        }
        // 他のアクターがいる場合
        // csvによる強制立ち絵位置変更があればそれに、なければパーティの先頭キャラなのか判定
        const position = forcePosition
            ? forcePosition
            : isPartyHeadActor(skitName) ? "左" : $gameSkit._openPositionForAutoShow(actors, positions);
        // 同じ位置にいる立ち絵を非表示
        autoSkitHide(skitName, actors, position);
        targetActor.showWithMode(showCommand, true, position);

    };

    // パーティの先頭キャラの立ち絵なのか判定
    const isPartyHeadActor = function (skitName) {
        // パーティメンバーの先頭キャラのスキット名と一致するか
        const actor = $gameParty.members()[0];
        const partyHeadSkitName = actor ? $aquaLocalize.getSkitName(actor.name()) : "";
        return partyHeadSkitName == skitName;
    };

    // 同じ位置にいる立ち絵を非表示
    const autoSkitHide = function (skitName, actors, position) {
        for (var i = 0; i < actors.length; i++) {
            const actor = actors[i];
            const differentActor = actor._name != skitName;
            const leftPositon = actor._position <= 1.5;
            if (position == "左" && differentActor && leftPositon) {
                $gameSkit.slideOutSkitActor([null, actor._name, true, 0.5, 4, null, 3]);
            }
            if (position == "右" && differentActor && !leftPositon) {
                $gameSkit.slideOutSkitActor([null, actor._name, true, 0.5, 4, null, 3]);
            }
        }
    };

    // 条件を元に立ち絵を表示
    const showSkitBranch = function (params, textData, text) {
        // アナザーニューゲーム中且つスキットのオートモードオフなら立ち絵処理をしない
        if ($aquaLocalize.isAnotherNewGameMode() && !$gameSkit.isAutoMode()) {
            return;
        }
        const speaker = params[4];
        const nameList = $aquaLocalize.getSkitKeyList();
        const notFaceId = textData.faceId == "";
        // 既に名前ボックスに日本語で名前が入っている新仕様の場合
        if (notFaceId && nameList.includes(speaker)) {
            showSkitSE(speaker, text, textData);
            return;
        }
        // 名前ボックスに日本語名がなく顔グラが設定してある旧仕様の場合
        if (notFaceId && params[0]) {
            showSkitFace(params, textData);
            return;
        }
        // textData.csvのfaceIdを参照する場合
        showSkit(params, textData);
    };

    // 顔グラを元に表情
    const showSkitFace = function (params, textData) {
        const faceName = params[0];
        const faceIndex = params[1];
        const skitName = faceToSkitExpression[faceName.replace(/\d+/g, "")];
        const faceId = faceToSkitExpression[faceName + "_" + faceIndex];
        const forcePosition = textData.skitPosition;
        $gameMessage.setFaceImage("", 0);
        $gameSkit.changeSkitActorExpression(["expression", skitName, "f", faceId]);
        autoShowSkitActor(skitName, forcePosition);
        // 表示する立ち絵以外をアンフォーカス
        skitUnfocus(skitName);
    };

    // \SE[n]を参照し立ち絵を表示
    const showSkitSE = function (speaker, text, textData) {
        const skitName = $aquaLocalize.getSkitName(speaker);
        if (skitName) {
            // \SE[n]が存在するなら表情変更、空なら前回の表情を引き継ぐ
            const SeFaceId = getSeFaceId(text);
            if (SeFaceId != "") {
                $gameSkit.changeSkitActorExpression(["expression", skitName, "f", SeFaceId]);
            }
            const forcePosition = textData.skitPosition;
            autoShowSkitActor(skitName, forcePosition);
        }
        // 表示する立ち絵以外をアンフォーカス
        skitUnfocus(skitName);
    };

    // textData.csvのfaceIdを参照し立ち絵を表示
    const showSkit = function (params, textData) {
        // 立ち絵の表情変更
        const faceName = params[0];
        // 名前が？？？などの特殊名だったときは顔グラを参照する
        const skitName = textData.skitName ?? faceToSkitExpression[faceName.replace(/\d+/g, "")];
        const faceId = textData.faceId;
        const forcePosition = textData.skitPosition;
        if (skitName && faceId != "") {
            $gameMessage.setFaceImage("", 0);
            $gameSkit.changeSkitActorExpression(["expression", skitName, "f", faceId]);
            autoShowSkitActor(skitName, forcePosition);
        }
        // 表示する立ち絵以外をアンフォーカス
        skitUnfocus(skitName);
    };

    // 表示する立ち絵以外をアンフォーカス
    const skitUnfocus = function (skitName) {
        const skitActors = Object.keys($gameSkit._skitActors);
        if (!skitActors || skitActors.length <= 0) { return; }
        skitActors.forEach(name => {
            if (name != skitName) {
                $gameSkit.unFocusSkitActor([null, name, false]);
            }
        });
    };

    // 顔グラを元に立ち絵の表情取得
    const faceToSkitExpression = {
        suzu: "suze",
        suzu1_0: "0",
        suzu1_1: "3",
        suzu1_2: "7",
        suzu1_3: "9-nb",
        suzu1_4: "11",
        suzu1_5: "2",
        suzu1_6: "12",
        suzu1_7: "8-nb",
        suzu2_0: "6-nb",
        suzu2_1: "10-nb",
        suzu2_2: "1",
        retoro: "retro",
        retoro1_0: "0",
        retoro1_1: "2-nb",
        retoro1_2: "3-nb",
        retoro1_3: "1",
        retoro1_4: "5-nb",
        retoro1_5: "4-nb",
        retoro1_6: "6",
        retoro1_7: "7",
        retoro2_0: "8-nb",
        chris: "chris",
        chris1_0: "0",
        chris1_1: "2",
        chris1_2: "3-nb",
        chris1_3: "1",
        chris1_4: "4-nb",
        chris1_5: "6",
        chris1_6: "5-nb",
        ruru: "ruru",
        ruru1_0: "0",
        ruru1_4: "1",
        kitty: "kitty",
        kitty1_0: "0",
        kitty1_1: "1",
        kitty1_2: "2",
        kitty1_3: "3",
        kitty1_4: "4-nb",
        kitty1_5: "5-nb",
        kitty1_6: "6-nb",
        kitty1_7: "7-nb",
        toto: "toi",
        toto1_0: "0",
        toto1_4: "2",
        toto2_0: "5-nb",
        toto2_4: "2"
    };

    ////////////////////////////////////////////////////////////////////////////////////////
    //  ボイス系
    ////////////////////////////////////////////////////////////////////////////////////////

    // ボイス再生
    Game_Interpreter.prototype.playVoice = function (voiceId) {
        AudioManager.stopVoice(null, "voice");
        if (!voiceId) { return; }
        const volume = GetVoiceVolume(voiceId);
        AudioManager.playVoice({ name: voiceId, volume: volume, pitch: 100, pan: 0 }, false, "voice");
    };

    // ボイス音量取得 (耳頼りの音量感覚なので、場合によって調整してください)
    const GetVoiceVolume = function (voiceId) {
        const realId = voiceId.slice(0, 2);
        switch (realId) {
            case "R0": return 100; // レトロ
            case "K0": return 110; // キティ
            default: return 105; // それ以外のキャラ
        }
    };

    // メッセージ閉じる時にボイス停止 (プラグインパラメーターで設定可能)
    const Window_Message_prototype_terminateMessage = Window_Message.prototype.terminateMessage;
    Window_Message.prototype.terminateMessage = function () {
        Window_Message_prototype_terminateMessage.apply(this, arguments);
        if (paramVoiceStop) {
            AudioManager.stopVoice(null, "voice");
        }
    };

    ////////////////////////////////////////////////////////////////////////////////////////
    //  立ち絵プラグインの表示系プラグインコマンドに表情先読みを追加
    ////////////////////////////////////////////////////////////////////////////////////////

    // イベントコマンドのプラグインコマンドに追加
    const Game_Interpreter_prototype_command357 = Game_Interpreter.prototype.command357;
    Game_Interpreter.prototype.command357 = function (params) {
        this.preloadSkitExpression(params);
        return Game_Interpreter_prototype_command357.apply(this, arguments);
    };

    // 立ち絵プラグインのコマンド「〇〇In」に表情先読み機能を追加
    Game_Interpreter.prototype.preloadSkitExpression = function (params) {
        if (!isSkitInCommand(params)) { return; }
        const name = params[3].name;
        // スキット名とアクター名どちらでも動く仕様になっているようです（クリス or chris など）
        const skitName = $aquaLocalize.getSkitName(name) || name;
        if (!skitName) { return; }
        const index = this._index + 1;
        const list = this._list;
        const length = list.length;
        let findCount = 0;
        for (let i = index; i < length; i++) {
            // 20個先のコマンドまで探しても見つからなかったら終了（負荷防止）
            findCount += 1;
            if (findCount > 20) { break; }
            // メッセージコマンドが見つかったら表情先読み
            const command = list[i];
            const isMessageCommand = command && command.code == 401;
            if (!isMessageCommand) { continue; }
            const text = command.parameters[0];
            const SeFaceId = getSeFaceId(text);
            // \SE[n]が存在するなら表情変更、空なら前回の表情を引き継ぐ
            if (SeFaceId != "") {
                $gameSkit.changeSkitActorExpression(["expression", skitName, "f", SeFaceId]);
            }
            break;
        }
    };

    // スキットイン系のコマンドか判定
    const isSkitInCommand = function (params) {
        const commandName = params[1];
        return params[0] == "TRP_SkitMZ" && ["slideIn", "fadeIn", "moveIn"].includes(commandName);
    };

    ////////////////////////////////////////////////////////////////////////////////////////
    //  ピクチャと遠景の多言語対応
    ////////////////////////////////////////////////////////////////////////////////////////

    // ピクチャ表示の際に言語別にする
    const Game_Picture_prototype_show = Game_Picture.prototype.show;
    Game_Picture.prototype.show = function (name, origin, x, y, scaleX, scaleY, opacity, blendMode) {
        const language = ConfigManager.language;
        const nameList = $aquaLocalize.getPictureList();
        if (language != "jp" && nameList.includes(name)) {
            name += "_" + language;
        }
        Game_Picture_prototype_show.apply(this, arguments);
    };

    // 遠景表示の際に言語別にする
    const Game_Map_prototype_setupParallax = Game_Map.prototype.setupParallax;
    Game_Map.prototype.setupParallax = function () {
        Game_Map_prototype_setupParallax.apply(this, arguments);
        const language = ConfigManager.language;
        const nameList = $aquaLocalize.getParallaxList();
        if (language != "jp" && nameList.includes(this._parallaxName)) {
            this._parallaxName += "_" + language;
        }
    };

    ////////////////////////////////////////////////////////////////////////////////////////
    //  エラー対策
    ////////////////////////////////////////////////////////////////////////////////////////

    // ロード時に、立ち絵プラグインの初期設定がされていない場合の対策
    const Scene_Map_updateMain = Scene_Map.prototype.updateMain;
    Scene_Map.prototype.updateMain = function () {
        if (!$gameSkit) {
            TRP_CORE.setupTRPSkitConfigParametersIfNeeded();
            $gameSkit = new Skit();
        }
        Scene_Map_updateMain.apply(this, arguments);
    };

    // アプリ終了時に稀にnw.jsが残ることがあるのを対策:Unity移植の際は不要
    if (Utils.isNwjs()) {
        const gui = require("nw.gui");
        if (typeof gui !== "undefined") {
            const win = gui.Window.get();
            win.removeAllListeners("close");
            win.on("close", function () {
                if (typeof nw === "object") {
                    nw.App.quit();
                } else {
                    this.close(true);
                }
            });
        }
    }

})();
