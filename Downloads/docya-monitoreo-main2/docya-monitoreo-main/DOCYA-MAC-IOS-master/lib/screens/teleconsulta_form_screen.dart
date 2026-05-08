import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../globals.dart';
import '../services/auth_service.dart';
import '../services/mercado_pago_native_service.dart';
import '../services/payment_methods_service.dart';
import '../widgets/docya_snackbar.dart';
import 'payment_checkout_browser_screen.dart';
import 'teleconsulta_waiting_screen.dart';

class TeleconsultaFormScreen extends StatefulWidget {
  final String pacienteUuid;

  const TeleconsultaFormScreen({super.key, required this.pacienteUuid});

  @override
  State<TeleconsultaFormScreen> createState() => _TeleconsultaFormScreenState();
}

class _TeleconsultaFormScreenState extends State<TeleconsultaFormScreen> {
  static const _bgBase = Color(0xFF071820);
  static const _surface = Color(0xFF102730);
  static const _primary = Color(0xFF25D7C8);
  static const _secondary = Color(0xFF14B8A6);
  static const _textMain = Color(0xFFD9ECF2);
  static const _textMuted = Color(0xFF9FB6BD);
  static const _textDark = Color(0xFF04232A);
  static const _warning = Color(0xFFFBBF24);

  final _motivoCtrl = TextEditingController();
  String _direccionGuardada = '';
  String _provinciaGuardada = '';
  String _localidadGuardada = '';
  String _detalleDireccion = '';
  bool _certificado = false;
  bool _consentimiento = false;
  bool _loading = false;
  bool _cargandoDireccion = true;
  bool _cargandoTarifa = true;
  bool _loadingSavedMethods = false;
  int? _precioActual;
  String _descripcionPrecio = '';
  int? _consultaPreviaId;
  String? _paymentId;
  String _pagoPreautorizado = '';
  final _paymentService = PaymentMethodsService();
  final _authService = AuthService();
  final _nativePaymentService = MercadoPagoNativeService();
  List<Map<String, dynamic>> _savedMethods = [];
  Map<String, dynamic>? _selectedSavedMethod;

  @override
  void initState() {
    super.initState();
    _cargarDireccionGuardada();
    _cargarTarifa();
    _cargarTarjetasGuardadas();
  }

  @override
  void dispose() {
    _motivoCtrl.dispose();
    super.dispose();
  }

  int _parseMonto(dynamic value) {
    if (value is int) return value;
    if (value is double) return value.round();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  String _formatPesos(int? value) {
    if (value == null || value <= 0) return '-';
    final raw = value.toString();
    final buffer = StringBuffer();
    for (var i = 0; i < raw.length; i++) {
      final left = raw.length - i;
      buffer.write(raw[i]);
      if (left > 1 && left % 3 == 1) buffer.write('.');
    }
    return '\$${buffer.toString()}';
  }

  void _toast(String message, {SnackType type = SnackType.error}) {
    if (!mounted) return;
    DocYaSnackbar.show(
      context,
      title: type == SnackType.error ? 'Atencion' : 'Teleconsulta',
      message: message,
      type: type,
    );
  }

  Future<void> _cargarTarifa() async {
    try {
      final res = await http.get(Uri.parse('$API_URL/tarifas/teleconsulta'));
      if (!mounted) return;
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final tipo = (data['tipo'] ?? '').toString();
        final esNocturna = tipo == 'teleconsulta_nocturna';
        setState(() {
          _precioActual = _parseMonto(data['monto']);
          _descripcionPrecio = esNocturna
              ? 'Tarifa nocturna (22:00-06:00).'
              : 'Tarifa diurna (06:00-22:00).';
          _cargandoTarifa = false;
        });
        return;
      }
    } catch (_) {}

    if (!mounted) return;
    setState(() => _cargandoTarifa = false);
  }

  Future<void> _cargarTarjetasGuardadas() async {
    setState(() => _loadingSavedMethods = true);
    try {
      final methods = await _paymentService.fetchMethods(widget.pacienteUuid);
      if (!mounted) return;
      setState(() {
        _savedMethods = methods;
        _selectedSavedMethod = methods.isNotEmpty ? methods.first : null;
        _loadingSavedMethods = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingSavedMethods = false);
    }
  }

  String _savedCardExpiration(Map<String, dynamic> item) {
    final month = item['expiration_month']?.toString().padLeft(2, '0') ?? '--';
    final yearRaw = item['expiration_year']?.toString() ?? '--';
    final year =
        yearRaw.length >= 2 ? yearRaw.substring(yearRaw.length - 2) : yearRaw;
    return '$month/$year';
  }

  String _savedCardLabel(Map<String, dynamic> item) {
    final brand = (item['brand'] ?? 'Tarjeta').toString();
    final lastFour = (item['last_four'] ?? '----').toString();
    return '$brand **** $lastFour';
  }

  bool _canReuseSavedMethod(Map<String, dynamic>? item) {
    if (item == null) return false;
    final cardId = item['mp_card_id']?.toString() ?? '';
    final customerId = item['mp_customer_id']?.toString() ?? '';
    final paymentMethodId = item['payment_method_id']?.toString() ?? '';
    final issuerId = item['issuer_id']?.toString() ?? '';
    final reusable = item['reusable'] == true;
    return reusable ||
        (cardId.isNotEmpty &&
            customerId.isNotEmpty &&
            paymentMethodId.isNotEmpty &&
            issuerId.isNotEmpty);
  }

  Future<void> _cargarDireccionGuardada() async {
    setState(() => _cargandoDireccion = true);
    try {
      final res = await http.get(
        Uri.parse('$API_URL/direccion/mia/${widget.pacienteUuid}'),
      );
      if (!mounted) return;

      if (res.statusCode == 200) {
        final data = jsonDecode(utf8.decode(res.bodyBytes));
        final direccion = (data['direccion'] ?? '').toString().trim();
        final partes = direccion
            .split(',')
            .map((e) => e.trim())
            .where((e) => e.isNotEmpty)
            .toList();
        final localidad =
            partes.length >= 2 ? partes[partes.length - 2] : direccion;
        final provincia = partes.length >= 3
            ? partes[partes.length - 2]
            : (partes.length >= 2 ? partes.last : 'Argentina');
        final detalles = [
          if ((data['piso'] ?? '').toString().trim().isNotEmpty)
            'Piso ${data['piso']}',
          if ((data['depto'] ?? '').toString().trim().isNotEmpty)
            'Depto ${data['depto']}',
          if ((data['indicaciones'] ?? '').toString().trim().isNotEmpty)
            data['indicaciones'].toString().trim(),
        ].join(' · ');

        setState(() {
          _direccionGuardada = direccion;
          _localidadGuardada = localidad;
          _provinciaGuardada = provincia;
          _detalleDireccion = detalles;
          _cargandoDireccion = false;
        });
        return;
      }
    } catch (_) {}

    if (!mounted) return;
    setState(() => _cargandoDireccion = false);
  }

  Future<void> _preautorizarYCrear() async {
    final precio = _precioActual;
    if (precio == null || precio <= 0) {
      _toast('No pudimos cargar el precio de la teleconsulta.');
      return;
    }
    if (_motivoCtrl.text.trim().isEmpty ||
        _direccionGuardada.isEmpty ||
        !_consentimiento) {
      _toast(
        'Completa el motivo, carga tu direccion y acepta el consentimiento.',
      );
      return;
    }

    setState(() => _loading = true);

    try {
      final previa = await http.post(
        Uri.parse('$API_URL/consultas/crear_previa'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'paciente_uuid': widget.pacienteUuid,
          'motivo': _motivoCtrl.text.trim(),
          'direccion': _direccionGuardada,
          'lat': 0,
          'lng': 0,
          'tipo': 'medico',
          'canal_atencion': 'teleconsulta',
        }),
      );

      if (previa.statusCode != 200) {
        _toast('No se pudo preparar la teleconsulta.');
        if (mounted) setState(() => _loading = false);
        return;
      }

      final previaData = jsonDecode(previa.body);
      _consultaPreviaId = previaData['consulta_id'];
      final motivoPago = _motivoCtrl.text.trim().isEmpty
          ? 'Teleconsulta DocYa'
          : _motivoCtrl.text.trim();

      if (Platform.isAndroid) {
        final config = await _paymentService.fetchPublicConfig();
        final profile =
            await _authService.fetchUserProfile(widget.pacienteUuid) ?? {};
        final wantsSavedCard = _selectedSavedMethod != null;
        final useSavedCard = _canReuseSavedMethod(_selectedSavedMethod);

        if (wantsSavedCard && !useSavedCard) {
          _toast(
            'Esta tarjeta guardada necesita revalidarse. Elegi otra o usa una tarjeta nueva.',
          );
          if (mounted) setState(() => _loading = false);
          return;
        }

        final nativeResult = useSavedCard
            ? await _nativePaymentService.collectSavedCardToken(
                publicKey: (config['public_key'] ?? '').toString(),
                countryCode: (config['country_code'] ?? 'ARG').toString(),
                title: 'Autoriza tu teleconsulta',
                description:
                    'DocYa reserva el pago y solo lo cobra cuando un medico acepta.',
                payerEmail: pacienteEmailGlobal,
                cardholderName: (_selectedSavedMethod!['holder_name'] ??
                        profile['full_name'] ??
                        'Titular')
                    .toString(),
                identificationType: (profile['tipo_documento'] ?? 'DNI')
                    .toString()
                    .toUpperCase(),
                identificationNumber:
                    (profile['numero_documento'] ?? '').toString(),
                savedCardId: _selectedSavedMethod!['mp_card_id'].toString(),
                savedCardBrand:
                    (_selectedSavedMethod!['brand'] ?? 'Tarjeta').toString(),
                savedCardLastFour:
                    (_selectedSavedMethod!['last_four'] ?? '----').toString(),
                savedCardExpiration:
                    _savedCardExpiration(_selectedSavedMethod!),
                paymentMethodId:
                    _selectedSavedMethod!['payment_method_id']?.toString(),
                issuerId: _selectedSavedMethod!['issuer_id']?.toString(),
              )
            : await _nativePaymentService.collectCardToken(
                publicKey: (config['public_key'] ?? '').toString(),
                countryCode: (config['country_code'] ?? 'ARG').toString(),
                amount: precio.toDouble(),
                title: 'Autoriza tu teleconsulta',
                description:
                    'DocYa reserva el pago y solo lo cobra cuando un medico acepta.',
                payerEmail: pacienteEmailGlobal,
                cardholderName: (profile['full_name'] ?? 'Titular').toString(),
                identificationType: (profile['tipo_documento'] ?? 'DNI')
                    .toString()
                    .toUpperCase(),
                identificationNumber:
                    (profile['numero_documento'] ?? '').toString(),
              );

        final status = nativeResult['status']?.toString() ?? 'cancelled';
        if (status != 'success') {
          final nativeError = nativeResult['error']?.toString();
          _toast(
            nativeError?.isNotEmpty == true
                ? nativeError!
                : status == 'cancelled'
                    ? 'Autorizacion cancelada'
                    : 'No se pudo preparar la tarjeta',
          );
          if (mounted) setState(() => _loading = false);
          return;
        }

        final authorization = await _paymentService.authorizeNativePayment(
          consultaId: _consultaPreviaId!,
          pacienteUuid: widget.pacienteUuid,
          monto: precio.toDouble(),
          motivo: motivoPago,
          tipo: 'teleconsulta',
          token: (nativeResult['token'] ?? '').toString(),
          paymentMethodId: useSavedCard
              ? _selectedSavedMethod!['payment_method_id'].toString()
              : (nativeResult['payment_method_id'] ?? '').toString(),
          issuerId: useSavedCard
              ? _selectedSavedMethod!['issuer_id']?.toString()
              : nativeResult['issuer_id']?.toString(),
          payerEmail:
              (nativeResult['payer_email'] ?? pacienteEmailGlobal).toString(),
          identificationType: nativeResult['identification_type']?.toString(),
          identificationNumber:
              nativeResult['identification_number']?.toString(),
          saveCard: nativeResult['save_card'] == true,
        );

        if (authorization['authorized'] != true) {
          _toast('No se pudo autorizar la tarjeta');
          if (mounted) setState(() => _loading = false);
          return;
        }

        _paymentId = authorization['payment_id']?.toString();
        _pagoPreautorizado = 'preautorizado';
        await _crear();
        return;
      }

      if (!mounted) return;
      final result = await Navigator.push<Map<String, dynamic>>(
        context,
        MaterialPageRoute(
          builder: (_) => PaymentCheckoutBrowserScreen(
            title: 'Autorizacion segura',
            url: _paymentService.buildEmbeddedPaymentUrl(
              pacienteUuid: widget.pacienteUuid,
              consultaId: _consultaPreviaId!,
              monto: precio.toDouble(),
              tipo: 'teleconsulta',
              motivo: motivoPago,
            ),
          ),
        ),
      );

      final status = result?['status']?.toString() ?? 'cancelled';
      if (status != 'success') {
        _toast(
          status == 'pending'
              ? 'El pago quedo pendiente de confirmacion'
              : status == 'cancelled'
                  ? 'Autorizacion cancelada'
                  : 'No se pudo autorizar el pago',
        );
        if (mounted) setState(() => _loading = false);
        return;
      }

      _paymentId = result!['payment_id']?.toString();
      _pagoPreautorizado = 'preautorizado';
      await _crear();
    } catch (e) {
      final message = e.toString().replaceFirst('Exception: ', '').trim();
      _toast(message.isEmpty ? 'Error al iniciar el pago' : message);
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _crear() async {
    if (_pagoPreautorizado != 'preautorizado' || _consultaPreviaId == null) {
      _toast('Debes autorizar el pago antes de pedir la teleconsulta.');
      if (mounted) setState(() => _loading = false);
      return;
    }

    if (_motivoCtrl.text.trim().isEmpty ||
        _direccionGuardada.isEmpty ||
        !_consentimiento) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Completá el motivo, cargá tu dirección y aceptá el consentimiento.',
          ),
        ),
      );
      return;
    }

    setState(() => _loading = true);
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token') ?? '';
    final res = await http.post(
      Uri.parse('$API_URL/teleconsultas'),
      headers: {
        'Content-Type': 'application/json',
        if (token.isNotEmpty) 'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'consulta_id': _consultaPreviaId,
        'paciente_uuid': widget.pacienteUuid,
        'motivo': _motivoCtrl.text.trim(),
        'direccion': _direccionGuardada,
        'provincia':
            _provinciaGuardada.isEmpty ? 'Argentina' : _provinciaGuardada,
        'localidad': _localidadGuardada.isEmpty
            ? _direccionGuardada
            : _localidadGuardada,
        'necesita_certificado': _certificado,
        'consentimiento_teleconsulta': _consentimiento,
        'metodo_pago': 'tarjeta',
        'payment_id': _paymentId ?? '',
      }),
    );
    if (!mounted) return;
    setState(() => _loading = false);

    if (res.statusCode != 200) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo crear la teleconsulta.')),
      );
      return;
    }

    final data = jsonDecode(res.body);
    await prefs.setString('teleconsulta_activa_id', data['id'].toString());
    final rawExpiresAt = (data['expires_at'] ?? '').toString();
    final parsedExpiresAt = DateTime.tryParse(rawExpiresAt)?.toLocal();
    final expiresAt = parsedExpiresAt != null &&
            parsedExpiresAt.isAfter(
              DateTime.now().subtract(const Duration(seconds: 10)),
            )
        ? parsedExpiresAt
        : DateTime.now().add(const Duration(minutes: 5));
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => TeleconsultaWaitingScreen(
          consultaId: data['id'],
          pacienteUuid: widget.pacienteUuid,
          expiresAt: expiresAt,
        ),
      ),
    );
  }

  Widget _field({
    required String label,
    required TextEditingController controller,
    required IconData icon,
    int maxLines = 1,
  }) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      style: GoogleFonts.manrope(color: _textMain, fontWeight: FontWeight.w600),
      cursorColor: _primary,
      decoration: InputDecoration(
        prefixIcon: Icon(icon, color: _primary, size: 20),
        labelText: label,
        labelStyle:
            GoogleFonts.manrope(color: _textMuted, fontWeight: FontWeight.w600),
        filled: true,
        fillColor: Colors.white.withOpacity(0.06),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: Colors.white.withOpacity(0.10)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: _primary, width: 1.4),
        ),
      ),
    );
  }

  Widget _glass({
    required Widget child,
    EdgeInsets padding = const EdgeInsets.all(16),
  }) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: _surface.withOpacity(0.78),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withOpacity(0.10)),
          ),
          child: child,
        ),
      ),
    );
  }

  Widget _direccionCard() {
    final sinDireccion = _direccionGuardada.isEmpty && !_cargandoDireccion;
    final subtitle = _cargandoDireccion
        ? 'Buscando dirección guardada...'
        : (sinDireccion
            ? 'No encontramos una dirección cargada en tu perfil.'
            : _direccionGuardada);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withOpacity(0.10)),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: (sinDireccion ? _warning : _primary).withOpacity(0.14),
              shape: BoxShape.circle,
            ),
            child: _cargandoDireccion
                ? const Padding(
                    padding: EdgeInsets.all(11),
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: _primary,
                    ),
                  )
                : Icon(
                    sinDireccion
                        ? PhosphorIconsRegular.warning
                        : PhosphorIconsRegular.mapPin,
                    color: sinDireccion ? _warning : _primary,
                    size: 21,
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Dirección de referencia',
                  style: GoogleFonts.manrope(
                    color: _textMain,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.manrope(
                    color: sinDireccion ? _warning : _textMuted,
                    fontSize: 12,
                    height: 1.25,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (_detalleDireccion.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    _detalleDireccion,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.manrope(
                      color: _textMuted.withOpacity(0.78),
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _toggleTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(value ? 0.09 : 0.04),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: value
                ? _primary.withOpacity(0.50)
                : Colors.white.withOpacity(0.09),
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: value ? _primary : _textMuted, size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.manrope(
                      color: _textMain,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: GoogleFonts.manrope(
                      color: _textMuted,
                      fontSize: 12,
                      height: 1.25,
                    ),
                  ),
                ],
              ),
            ),
            Switch.adaptive(
              value: value,
              activeColor: _primary,
              onChanged: onChanged,
            ),
          ],
        ),
      ),
    );
  }

  Widget _precioCard() {
    return _glass(
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: _primary.withOpacity(0.14),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              PhosphorIconsRegular.creditCard,
              color: _primary,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Valor de la teleconsulta',
                  style: GoogleFonts.manrope(
                    color: _textMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  _cargandoTarifa
                      ? 'Cargando precio...'
                      : '${_formatPesos(_precioActual)} pesos',
                  style: GoogleFonts.manrope(
                    color: _textMain,
                    fontSize: 21,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (_descripcionPrecio.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    _descripcionPrecio,
                    style: GoogleFonts.manrope(
                      color: _textMuted,
                      fontSize: 11.5,
                      height: 1.25,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoTeleconsultaCard() {
    final bullets = [
      'Certificados medicos simples',
      'Recetas medicas',
      'Ansiedad o estres',
      'Seguimiento medico',
      'Dudas rapidas de salud',
      'Interpretacion de estudios',
      'Renovacion de medicacion',
    ];

    return _glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Cuando elegir una teleconsulta',
            style: GoogleFonts.manrope(
              color: _textMain,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Ideal para consultas rapidas o situaciones que no requieren examen fisico inmediato.',
            style: GoogleFonts.manrope(
              color: _textMuted,
              fontSize: 12.5,
              height: 1.35,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          ...bullets.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    PhosphorIconsFill.checkCircle,
                    color: _primary,
                    size: 17,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      item,
                      style: GoogleFonts.manrope(
                        color: _textMain,
                        fontSize: 12.5,
                        height: 1.24,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: _warning.withOpacity(0.10),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: _warning.withOpacity(0.28)),
            ),
            child: Text(
              'Si el profesional detecta que necesitas revision presencial, podra indicarte una consulta medica a domicilio.',
              style: GoogleFonts.manrope(
                color: _textMain,
                fontSize: 12,
                height: 1.35,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _paymentCard() {
    final selected = _selectedSavedMethod;
    final hasReusable = _canReuseSavedMethod(selected);

    return _glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                PhosphorIconsRegular.lockKey,
                color: _primary,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Pago con preautorizacion',
                  style: GoogleFonts.manrope(
                    color: _textMain,
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'No se cobra ahora. DocYa reserva el pago y lo confirma solo cuando un medico acepta la teleconsulta. Si nadie la toma o la cancelas a tiempo, la reserva se libera.',
            style: GoogleFonts.manrope(
              color: _textMuted,
              fontSize: 12.5,
              height: 1.38,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (_loadingSavedMethods) ...[
            const SizedBox(height: 12),
            const LinearProgressIndicator(
              minHeight: 3,
              color: _primary,
              backgroundColor: Colors.transparent,
            ),
          ] else if (_savedMethods.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.05),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withOpacity(0.10)),
              ),
              child: Row(
                children: [
                  Icon(
                    hasReusable
                        ? PhosphorIconsRegular.creditCard
                        : PhosphorIconsRegular.warning,
                    color: hasReusable ? _primary : _warning,
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      selected == null
                          ? 'Se pedira una tarjeta'
                          : _savedCardLabel(selected),
                      style: GoogleFonts.manrope(
                        color: _textMain,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () => setState(() => _selectedSavedMethod =
                        _selectedSavedMethod == null
                            ? _savedMethods.first
                            : null),
                    child: Text(
                      selected == null ? 'Usar guardada' : 'Otra',
                      style: GoogleFonts.manrope(fontWeight: FontWeight.w900),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bgBase,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [_bgBase, Color(0xFF0B2732), Color(0xFF071820)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(18, 10, 18, 22),
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(
                      PhosphorIconsRegular.arrowLeft,
                      color: _textMain,
                    ),
                  ),
                  Text(
                    'Teleconsulta',
                    style: GoogleFonts.manrope(
                      color: _textMain,
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(26),
                  gradient: const LinearGradient(
                    colors: [_secondary, Color(0xFF0B3440)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: _secondary.withOpacity(0.18),
                      blurRadius: 24,
                      offset: const Offset(0, 14),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 58,
                      height: 58,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: _primary,
                      ),
                      child: const Icon(
                        PhosphorIconsFill.videoCamera,
                        color: _textDark,
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Atención online',
                            style: GoogleFonts.manrope(
                              color: _primary,
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Un médico por videollamada',
                            style: GoogleFonts.manrope(
                              color: _textMain,
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            'Te avisamos cuando un profesional acepta la consulta.',
                            style: GoogleFonts.manrope(
                              color: _textMain.withOpacity(0.78),
                              fontSize: 12.5,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              _precioCard(),
              const SizedBox(height: 12),
              _infoTeleconsultaCard(),
              const SizedBox(height: 12),
              _glass(
                child: Column(
                  children: [
                    _field(
                      label: 'Motivo de consulta',
                      controller: _motivoCtrl,
                      icon: PhosphorIconsRegular.stethoscope,
                      maxLines: 4,
                    ),
                    const SizedBox(height: 12),
                    _direccionCard(),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _toggleTile(
                icon: PhosphorIconsRegular.fileText,
                title: 'Certificado médico',
                subtitle: 'Lo solicitás para que el profesional lo evalúe.',
                value: _certificado,
                onChanged: (v) => setState(() => _certificado = v),
              ),
              const SizedBox(height: 10),
              _paymentCard(),
              const SizedBox(height: 10),
              _toggleTile(
                icon: PhosphorIconsRegular.shieldCheck,
                title: 'Consentimiento obligatorio',
                subtitle: 'Acepto realizar la atención por teleconsulta.',
                value: _consentimiento,
                onChanged: (v) => setState(() => _consentimiento = v),
              ),
              const SizedBox(height: 18),
              ElevatedButton.icon(
                onPressed: _loading || _cargandoDireccion || _cargandoTarifa
                    ? null
                    : _preautorizarYCrear,
                icon: _loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: _textDark,
                        ),
                      )
                    : const Icon(PhosphorIconsBold.videoCamera),
                label: Text(
                  _loading
                      ? 'Autorizando...'
                      : 'Autorizar y pedir teleconsulta',
                ),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 54),
                  backgroundColor: _primary,
                  disabledBackgroundColor: _primary.withOpacity(0.45),
                  foregroundColor: _textDark,
                  textStyle: GoogleFonts.manrope(
                    fontWeight: FontWeight.w900,
                    fontSize: 15,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                  elevation: 0,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
