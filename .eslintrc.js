module.exports = {
    "extends": [
      "airbnb-typescript",
      "airbnb/hooks",
      "plugin:prettier/recommended",
      "prettier", // `prettier/*`は全ていらない ref: https://github.com/prettier/eslint-config-prettier/issues/2
    ],
    "plugins": ["@typescript-eslint"],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
      "sourceType": "module",
      "ecmaFeatures": {
        "jsx": true
      },
      "project": "./tsconfig.json",
      "tsconfigRootDir": __dirname, // rootのtsconfig.jsonを各パッケージから参照する
    },
    "env": {
        "es6": true,
        "browser": true,
        "node": true,
        "jest": true
    },
    "rules": {    
      // 将来的にoff外すべきなもの
      "react/require-default-props": "off",
      "jsx-a11y/label-has-associated-control": "off", // labelのhtmlForを正しく認識してくれていない
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/no-static-element-interactions": "off",
      "import/no-cycle": "off",
  
      // 検討してから外すべきか考えるもの
      "react/jsx-props-no-spreading": "off", // test時やstorybookを使う時に楽。ただ、もし見にくかったら変える。
      "default-case": "off", // 別にTypeScriptでやっている以上、string literal以外のものが渡されることってないのではないか。
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": "off", // reduxのactionをcomponentで使う時は、destructureして使っている。ただ、これはエラーの元なので後でoffを外す。
      "import/no-named-as-default": "off", // テスト時にreduxを外して使うために、同じComponentがexportとexport defaultが使われている時があるのでoff。
      "no-return-assign": "off", // テスト時に多用しているパターンなのでoff。
      "consistent-return": "off", // 個人的にこの方が見やすいと思っている。特に、lodashのmergeWithとか"もし途中でreturnする必要性があるもの"を強調したい時。
  
      // 必要なもの
      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-expressions": [
        "error", 
        {
          "allowShortCircuit": true, // onChange && onChange()と書きたい
          "allowTernary": true // a === 1 ? b() : c()と書きたい
        }
      ],
  
      "no-plusplus": [ // loop時にはi++を使いたい。
        "error", 
        {
          "allowForLoopAfterthoughts": true
        }
      ],
      "jsx-a11y/aria-role": "off", // React Testing Libraryは、Roleを多用する。公式でも、既存のRoleと被りがないRoleを使うことを推奨しているので、これは必要。
      "no-nested-ternary": "off", // JSX内で使うので必要。if elseよりも見やすい
      "no-use-before-define": "off",
      "@typescript-eslint/no-use-before-define": "off", // styled-componentsはComponentの下で定義した方が見やすい。
      "no-underscore-dangle": "off",
      "@typescript-eslint/no-underscore-dangle": "off", // mongoDBではDocumentの識別するために_idが与えられているので、必要
      "@typescript-eslint/naming-convention": "off" // mongoDBの_idがあるので、必要。
    }
  }