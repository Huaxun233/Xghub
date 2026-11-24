import 'dart:async';

import 'package:flutter/material.dart';

import '../../core_bridge.dart';
import '../../models.dart';
import '../app_scope.dart';
import '../widgets/focus_ring.dart';
import '../widgets/form_text_field.dart';

bool aigoAccountAvailable() {
  final site = SourceSite.byId('aigo');
  return site.available && site.account;
}

class AigoAccountButton extends StatefulWidget {
  const AigoAccountButton({super.key, required this.admin, this.style});
  final bool admin;
  final ButtonStyle? style;

  @override
  State<AigoAccountButton> createState() => _AigoAccountButtonState();
}

class _AigoAccountButtonState extends State<AigoAccountButton> {
  Map<String, dynamic>? _status;
  var _busy = false;

  AppRepository get _repository => AppScope.of(context).repository;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final status = await _repository
        .sourceAccount('aigo')
        .catchError((_) => <String, dynamic>{});
    if (mounted) setState(() => _status = status);
  }

  Future<void> _manage() async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: false,
      builder: (_) =>
          _AigoAccountDialog(repository: AppScope.of(context).repository),
    );
    if (result != null && mounted) await _load();
  }

  Future<void> _logout() async {
    setState(() => _busy = true);
    try {
      await _repository.sourceAccount('aigo', command: 'logout');
      if (mounted) setState(() => _status = {'loggedIn': false});
    } catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$failure')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final loggedIn = _status?['loggedIn'] == true;
    return FocusRing(
      radius: 20,
      child: FilledButton.tonalIcon(
        style: widget.style,
        onPressed: widget.admin && _status != null && !_busy
            ? (loggedIn ? _logout : _manage)
            : null,
        icon: Icon(loggedIn ? Icons.logout_rounded : Icons.login_rounded),
        label: Text(
          loggedIn
              ? '退出${_status?['email'] is String && (_status?['email'] as String).isNotEmpty ? ' (${_status?['email']})' : ''}'
              : '登录爱果',
        ),
      ),
    );
  }
}

class _AigoAccountDialog extends StatefulWidget {
  const _AigoAccountDialog({required this.repository});
  final AppRepository repository;

  @override
  State<_AigoAccountDialog> createState() => _AigoAccountDialogState();
}

class _AigoAccountDialogState extends State<_AigoAccountDialog> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  final _passwordFocus = FocusNode();
  final _codeFocus = FocusNode();
  var _registering = false;
  var _busy = false;
  var _sending = false;
  Timer? _countdown;
  var _countdownSeconds = 0;
  String? _error;

  @override
  void dispose() {
    _countdown?.cancel();
    _email.dispose();
    _password.dispose();
    _code.dispose();
    _passwordFocus.dispose();
    _codeFocus.dispose();
    super.dispose();
  }

  void _switchMode() {
    setState(() {
      _registering = !_registering;
      _error = null;
    });
  }

  Future<void> _sendCode() async {
    final email = _email.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = '请填写正确的邮箱地址');
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await widget.repository.sourceAccount(
        'aigo',
        command: 'sendCode',
        account: {'email': email},
      );
      if (!mounted) return;
      setState(() {
        _countdownSeconds = 60;
        _countdown?.cancel();
        _countdown = Timer.periodic(const Duration(seconds: 1), (timer) {
          if (!mounted) return timer.cancel();
          setState(() {
            _countdownSeconds -= 1;
            if (_countdownSeconds <= 0) timer.cancel();
          });
        });
      });
    } catch (failure) {
      if (mounted) setState(() => _error = '$failure');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    final password = _password.text;
    if (email.isEmpty || password.isEmpty) {
      setState(() => _error = '请填写邮箱和密码');
      return;
    }
    if (_registering && _code.text.trim().isEmpty) {
      setState(() => _error = '请先获取并填写邮箱验证码');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final status = await widget.repository.sourceAccount(
        'aigo',
        command: _registering ? 'register' : 'login',
        account: _registering
            ? {'email': email, 'password': password, 'code': _code.text.trim()}
            : {'email': email, 'password': password},
      );
      if (!mounted) return;
      if (status['loggedIn'] != true) {
        setState(() {
          _busy = false;
          _error = '操作没有生效，请重试';
        });
        return;
      }
      Navigator.pop(context, status);
    } catch (failure) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = '$failure';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(_registering ? '注册爱果账号' : '登录爱果'),
      content: SizedBox(
        width: 352,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 12,
            children: [
              FormTextField(
                controller: _email,
                autofocus: true,
                maxLength: 128,
                onSubmitted: (_) => _codeFocus.requestFocus(),
                decoration: const InputDecoration(labelText: '邮箱'),
              ),
              if (_registering)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 8,
                  children: [
                    Expanded(
                      child: FormTextField(
                        controller: _code,
                        focusNode: _codeFocus,
                        maxLength: 8,
                        onSubmitted: (_) => _passwordFocus.requestFocus(),
                        decoration: const InputDecoration(labelText: '邮箱验证码'),
                      ),
                    ),
                    FocusRing(
                      radius: 20,
                      child: TextButton(
                        onPressed:
                            _sending || _countdownSeconds > 0
                                ? null
                                : _sendCode,
                        child: Text(
                          _sending
                              ? '发送中'
                              : _countdownSeconds > 0
                              ? '$_countdownSeconds 秒'
                              : '发送验证码',
                        ),
                      ),
                    ),
                  ],
                ),
              FormTextField(
                controller: _password,
                focusNode: _passwordFocus,
                obscure: true,
                maxLength: 128,
                onSubmitted: (_) => _submit(),
                decoration: InputDecoration(
                  labelText: _registering ? '设置密码' : '密码',
                  errorText: _error,
                ),
              ),
              if (_error != null)
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              Align(
                alignment: Alignment.centerLeft,
                child: FocusRing(
                  radius: 20,
                  child: TextButton(
                    onPressed: _busy ? null : _switchMode,
                    child: Text(_registering ? '已有账号？去登录' : '没有账号？注册一个'),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        FocusRing(
          radius: 20,
          child: TextButton(
            onPressed: _busy ? null : () => Navigator.pop(context),
            child: const Text('取消'),
          ),
        ),
        FocusRing(
          radius: 20,
          child: FilledButton(
            onPressed: _busy ? null : _submit,
            child: Text(_registering ? '注册并登录' : '登录'),
          ),
        ),
      ],
    );
  }
}
