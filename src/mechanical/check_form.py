"""回答本文の字数・文字種・括弧を検査する。"""
import argparse
import json
import re


def check(data):
    if not isinstance(data, dict) or set(data) - {'answers', 'exact_length', 'character_pattern', 'quote_limit', 'exception'}:
        raise ValueError('検査入力の項目が不正です')
    answers = data.get('answers')
    if not isinstance(answers, list) or len(answers) != 5 or not all(isinstance(a, str) and a for a in answers):
        raise ValueError('answersには空でない本文を5本入れてください')
    exact = data.get('exact_length')
    if exact is not None and (type(exact) is not int or exact < 1):
        raise ValueError('exact_lengthは正の整数です')
    pattern = data.get('character_pattern')
    if pattern is not None and not isinstance(pattern, str):
        raise ValueError('character_patternは正規表現の文字列です')
    compiled = re.compile(pattern) if pattern is not None else None
    quote_limit = data.get('quote_limit', 1)
    if type(quote_limit) is not int or quote_limit not in (1, 2):
        raise ValueError('quote_limitは1または2です')
    exception = data.get('exception')
    if exception is not None:
        if (not isinstance(exception, dict) or set(exception) != {'index', 'rule'}
                or type(exception['index']) is not int or not 1 <= exception['index'] <= 5
                or exception['rule'] not in ('exact_length', 'character_pattern')
                or data.get(exception['rule']) is None):
            raise ValueError('exceptionは1本のindexと、実在する形式条件のruleだけを指定してください')
    issues = []
    def exempt(index, rule):
        return exception is not None and exception['index'] == index and exception['rule'] == rule
    for index, answer in enumerate(answers, 1):
        length = len(answer)
        if length > 20:
            issues.append({'index': index, 'rule': 'max_length', 'actual': length, 'expected': 20})
        if exact is not None and length != exact and not exempt(index, 'exact_length'):
            issues.append({'index': index, 'rule': 'exact_length', 'actual': length, 'expected': exact})
        if compiled is not None and length <= 20 and compiled.fullmatch(answer) is None and not exempt(index, 'character_pattern'):
            issues.append({'index': index, 'rule': 'character_pattern'})
    quoted = sum('「' in a or '」' in a for a in answers)
    if quoted > quote_limit:
        issues.append({'rule': 'quote_limit', 'actual': quoted, 'expected': quote_limit})
    return {'valid': not issues, 'answers': answers, 'lengths': [len(a) for a in answers],
            'quoted_answers': quoted, 'issues': issues}

def main():
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument('--check-json', required=True, metavar='JSON', help='本文と形式条件のJSON')
    args = parser.parse_args()
    try:
        report = check(json.loads(args.check_json))
    except (ValueError, TypeError, re.error) as error:
        print(json.dumps({'valid': False, 'input_error': str(error)}, ensure_ascii=False))
        raise SystemExit(2)
    print(json.dumps(report, ensure_ascii=False))

if __name__ == '__main__':
    main()
