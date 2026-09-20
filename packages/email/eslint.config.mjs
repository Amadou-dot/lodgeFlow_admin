import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';
export default [{ignores:['node_modules/**']},js.configs.recommended,{files:['**/*.ts'],languageOptions:{parser,globals:{process:'readonly',global:'readonly',console:'readonly',setTimeout:'readonly'}},plugins:{'@typescript-eslint':plugin},rules:{'no-undef':'off','no-unused-vars':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]}}];
