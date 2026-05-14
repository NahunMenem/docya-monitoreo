// ============================================================
//  SOLICITUD MÉDICO – VERSION PROFESIONAL DOCYA (FLUJO NUEVO)
//  PREAUTORIZACIÓN SEGURA + DEEP LINK + CREAR PREVIA + VERIFICACIÓN BACKEND
// ============================================================

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../globals.dart';
import '../services/auth_service.dart';
import '../services/mercado_pago_native_service.dart';
import '../services/payment_methods_service.dart';
import '../widgets/confirmar_direccion_modal.dart';
import '../widgets/docya_snackbar.dart';
import 'buscando_medico_screen.dart';
import 'complete_profile_screen.dart';
import 'payment_checkout_browser_screen.dart';
import 'registrar_direccion_screen.dart';

class SolicitudMedicoScreen extends StatefulWidget {
  final String direccion;
  final LatLng ubicacion;
  final String? motivoInicial;

  const SolicitudMedicoScreen({
    super.key,
    required this.direccion,
    required this.ubicacion,
    this.motivoInicial,
  });

  @override
  State<SolicitudMedicoScreen> createState() => _SolicitudMedicoScreenState();
}

class _MedicalService {
  final String title;
  final String badge;
  final String subtitle;
  final String duration;
  final IconData icon;
  final Color color;
  final List<String> includes;
  final List<String> solves;
  final List<String> notes;

  const _MedicalService({
    required this.title,
    required this.badge,
    required this.subtitle,
    required this.duration,
    required this.icon,
    required this.color,
    required this.includes,
    required this.solves,
    required this.notes,
  });
}

class _SolicitudMedicoScreenState extends State<SolicitudMedicoScreen>
    with WidgetsBindingObserver {
  final motivoCtrl = TextEditingController();
  bool aceptaConsentimiento = false;
  String metodoPago = "tarjeta";
  bool pagando = false;
  final _paymentService = PaymentMethodsService();
  final _authService = AuthService();
  final _nativePaymentService = MercadoPagoNativeService();
  List<Map<String, dynamic>> _savedMethods = [];
  Map<String, dynamic>? _selectedSavedMethod;
  bool _loadingSavedMethods = false;

  int? consultaPreviaId;
  String pagoPreautorizadoGlobal = "";
  String? _paymentId;
  bool pagoConfirmadoUnaVez = false;
  late String _direccionActual;
  late LatLng _ubicacionActual;

  // Tarifa cargada desde la API
  int? _precioActual;
  String _descripcionPrecio = "";
  bool _cargandoTarifa = true;
  int? _selectedServiceIndex;

  static const List<_MedicalService> _services = [
    _MedicalService(
      title: "Clinica medica",
      badge: "Consulta a domicilio",
      subtitle:
          "Consulta medica general para adultos. Evaluacion, diagnostico y tratamiento de sintomas comunes.",
      duration: "30-45 min",
      icon: Icons.medical_services_rounded,
      color: Color(0xFF0F9B91),
      includes: [
        "Evaluacion medica completa",
        "Diagnostico y plan de tratamiento",
        "Receta medica digital",
        "Informe en tu historial clinico",
        "Seguimiento por chat (48 hs)",
      ],
      solves: [
        "Fiebre, gripe y resfrios",
        "Dolores de cabeza, garganta, estomago o musculares",
        "Malestar general y cansancio",
        "Alergias y problemas respiratorios",
        "Control y seguimiento de enfermedades cronicas",
        "Prescripcion y renovacion de medicacion",
        "Certificado medico",
        "Y mucho mas...",
      ],
      notes: [
        "La consulta es a domicilio en el dia.",
        "Si el medico considera necesario estudios o practicas, te lo indicara.",
        "En caso de urgencia, llama al 911.",
      ],
    ),
  ];

  int _parseMonto(dynamic value) {
    if (value is int) return value;
    if (value is double) return value.round();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _direccionActual = widget.direccion;
    _ubicacionActual = widget.ubicacion;
    if (widget.motivoInicial != null && widget.motivoInicial!.isNotEmpty) {
      motivoCtrl.text = widget.motivoInicial!;
    }
    _cargarTarifa();
    _cargarTarjetasGuardadas();
    _verificarPerfilCompleto();
  }

  Future<void> _verificarPerfilCompleto() async {
    final prefs = await SharedPreferences.getInstance();
    final perfilCompleto = prefs.getBool("perfilCompleto") ?? false;
    if (!perfilCompleto && mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => const CompleteProfileScreen(forceProfile: true),
        ),
      );
    }
  }

  Future<void> _cargarTarifa() async {
    try {
      final res = await http.get(
        Uri.parse('$API_URL/tarifas/consulta-medico'),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          _precioActual = _parseMonto(data['monto']);
          _descripcionPrecio = data['descripcion'] ?? '';
          _cargandoTarifa = false;
        });
      }
    } catch (_) {
      setState(() => _cargandoTarifa = false);
    }
  }

  Future<void> _cargarTarjetasGuardadas() async {
    setState(() => _loadingSavedMethods = true);
    try {
      final methods = await _paymentService.fetchMethods(pacienteUuidGlobal);
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
    final brand = (item["brand"] ?? "Tarjeta").toString();
    final lastFour = (item["last_four"] ?? "----").toString();
    return '$brand **** $lastFour';
  }

  bool _canReuseSavedMethod(Map<String, dynamic>? item) {
    if (item == null) return false;
    final cardId = item["mp_card_id"]?.toString() ?? "";
    final customerId = item["mp_customer_id"]?.toString() ?? "";
    final paymentMethodId = item["payment_method_id"]?.toString() ?? "";
    final issuerId = item["issuer_id"]?.toString() ?? "";
    final reusable = item["reusable"] == true;
    return reusable ||
        (cardId.isNotEmpty &&
            customerId.isNotEmpty &&
            paymentMethodId.isNotEmpty &&
            issuerId.isNotEmpty);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    motivoCtrl.dispose();
    super.dispose();
  }

  // ============================================================
  // 🔥 Verificar estado de pago desde BACKEND
  // ============================================================
  Future<void> _verificarPagoBackend() async {
    if (consultaPreviaId == null) return;

    try {
      final res = await http.get(
        Uri.parse(
            "https://docya-railway-production.up.railway.app/consultas/$consultaPreviaId/estado"),
      );

      if (res.statusCode != 200) return;

      final data = jsonDecode(res.body);

      final preaut = data["mp_preautorizado"] == true;
      _paymentId = data["payment_id"]?.toString();

      // Solo habilitar si el backend indica preautorización real
      if (preaut) {
        setState(() {
          pagoPreautorizadoGlobal = "preautorizado";
        });
      } else {
        setState(() {
          pagoPreautorizadoGlobal = "";
        });
      }
    } catch (e) {
      setState(() {
        pagoPreautorizadoGlobal = "";
      });
    }
  }

  // ============================================================
  // 👀 Monitorear cuando la app vuelve al frente
  // ============================================================
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _verificarPagoBackend();
    }
  }

  Future<bool> _confirmarDireccionAntesDeContinuar() async {
    while (mounted) {
      final accion = await mostrarConfirmarDireccionModal(
        context: context,
        servicio: 'médico',
        direccion: _direccionActual,
      );

      if (accion == DireccionConfirmadaAccion.confirmar) {
        return true;
      }
      if (accion != DireccionConfirmadaAccion.modificar) {
        return false;
      }

      final datos = await Navigator.push<Map<String, dynamic>>(
        context,
        MaterialPageRoute(
          builder: (_) => RegistrarDireccionScreen(
            userId: pacienteUuidGlobal,
            forceRequired: true,
          ),
        ),
      );

      if (!mounted) return false;
      if (datos == null) continue;

      final nuevaDireccion = (datos['direccion'] ?? '').toString().trim();
      final lat = datos['lat'];
      final lng = datos['lng'];
      if (nuevaDireccion.isNotEmpty && lat is num && lng is num) {
        setState(() {
          _direccionActual = nuevaDireccion;
          _ubicacionActual = LatLng(lat.toDouble(), lng.toDouble());
        });
      }
    }
    return false;
  }

  // ============================================================
  // ============================================================
  // 💳 1. CREAR CONSULTA PREVIA + PREAUTORIZAR PAGO
  // ============================================================
  Future<void> _pagar() async {
    final precio = _precioActual;
    if (precio == null) return;

    if (motivoCtrl.text.trim().isEmpty) {
      _toast("Completa el motivo");
      return;
    }
    if (!aceptaConsentimiento) {
      _toast("Debes aceptar la declaracion jurada");
      return;
    }
    if (!await _confirmarDireccionAntesDeContinuar()) return;
    setState(() => pagando = true);

    try {
      final previa = await http.post(
        Uri.parse(
            "https://docya-railway-production.up.railway.app/consultas/crear_previa"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "paciente_uuid": pacienteUuidGlobal,
          "motivo": motivoCtrl.text.trim(),
          "direccion": _direccionActual,
          "lat": _ubicacionActual.latitude,
          "lng": _ubicacionActual.longitude,
          "tipo": "medico"
        }),
      );

      if (previa.statusCode != 200) {
        _toast("Error creando consulta");
        setState(() => pagando = false);
        return;
      }

      final previaData = jsonDecode(previa.body);
      consultaPreviaId = previaData["consulta_id"];
      final motivoPago = motivoCtrl.text.trim().isEmpty
          ? "Consulta medica DocYa"
          : motivoCtrl.text.trim();

      if (Platform.isAndroid) {
        final config = await _paymentService.fetchPublicConfig();
        final profile =
            await _authService.fetchUserProfile(pacienteUuidGlobal) ?? {};
        final wantsSavedCard = _selectedSavedMethod != null;
        final useSavedCard = _canReuseSavedMethod(_selectedSavedMethod);

        if (wantsSavedCard && !useSavedCard) {
          _toast(
            "Esta tarjeta guardada necesita revalidarse. Elegi otra o usa una tarjeta nueva.",
          );
          setState(() => pagando = false);
          return;
        }

        final nativeResult = useSavedCard
            ? await _nativePaymentService.collectSavedCardToken(
                publicKey: (config["public_key"] ?? "").toString(),
                countryCode: (config["country_code"] ?? "ARG").toString(),
                title: "Autoriza tu consulta",
                description:
                    "DocYa reserva el pago y solo lo captura cuando un medico acepta tu pedido.",
                payerEmail: pacienteEmailGlobal,
                cardholderName: (_selectedSavedMethod!["holder_name"] ??
                        profile["full_name"] ??
                        "Titular")
                    .toString(),
                identificationType: (profile["tipo_documento"] ?? "DNI")
                    .toString()
                    .toUpperCase(),
                identificationNumber:
                    (profile["numero_documento"] ?? "").toString(),
                savedCardId: _selectedSavedMethod!["mp_card_id"].toString(),
                savedCardBrand:
                    (_selectedSavedMethod!["brand"] ?? "Tarjeta").toString(),
                savedCardLastFour:
                    (_selectedSavedMethod!["last_four"] ?? "----").toString(),
                savedCardExpiration:
                    _savedCardExpiration(_selectedSavedMethod!),
                paymentMethodId:
                    _selectedSavedMethod!["payment_method_id"]?.toString(),
                issuerId: _selectedSavedMethod!["issuer_id"]?.toString(),
              )
            : await _nativePaymentService.collectCardToken(
                publicKey: (config["public_key"] ?? "").toString(),
                countryCode: (config["country_code"] ?? "ARG").toString(),
                amount: precio.toDouble(),
                title: "Autoriza tu consulta",
                description:
                    "DocYa reserva el pago y solo lo captura cuando un medico acepta tu pedido.",
                payerEmail: pacienteEmailGlobal,
                cardholderName: (profile["full_name"] ?? "Titular").toString(),
                identificationType: (profile["tipo_documento"] ?? "DNI")
                    .toString()
                    .toUpperCase(),
                identificationNumber:
                    (profile["numero_documento"] ?? "").toString(),
              );

        final status = nativeResult["status"]?.toString() ?? "cancelled";
        if (status != "success") {
          final nativeError = nativeResult["error"]?.toString();
          _toast(
            nativeError?.isNotEmpty == true
                ? nativeError!
                : status == "cancelled"
                    ? "Autorizacion cancelada"
                    : "No se pudo preparar la tarjeta",
          );
          setState(() => pagando = false);
          return;
        }

        final authorization = await _paymentService.authorizeNativePayment(
          consultaId: consultaPreviaId!,
          pacienteUuid: pacienteUuidGlobal,
          monto: precio.toDouble(),
          motivo: motivoPago,
          tipo: "medico",
          token: (nativeResult["token"] ?? "").toString(),
          paymentMethodId: useSavedCard
              ? _selectedSavedMethod!["payment_method_id"].toString()
              : (nativeResult["payment_method_id"] ?? "").toString(),
          issuerId: useSavedCard
              ? _selectedSavedMethod!["issuer_id"]?.toString()
              : nativeResult["issuer_id"]?.toString(),
          payerEmail:
              (nativeResult["payer_email"] ?? pacienteEmailGlobal).toString(),
          identificationType: nativeResult["identification_type"]?.toString(),
          identificationNumber:
              nativeResult["identification_number"]?.toString(),
          saveCard: nativeResult["save_card"] == true,
        );

        if (authorization["authorized"] != true) {
          // Cancelar la preautorización en el backend para liberar fondos
          if (consultaPreviaId != null) {
            http
                .post(
                  Uri.parse('$API_URL/consultas/$consultaPreviaId/cancelar_busqueda'),
                  headers: {"Content-Type": "application/json"},
                  body: jsonEncode({"paciente_uuid": pacienteUuidGlobal}),
                )
                .catchError((_) {});
          }
          final mpStatus = authorization["status"]?.toString() ?? "";
          final msg = mpStatus == "in_process"
              ? "Tu banco está procesando el pago. Intentá con otra tarjeta o pagá con dinero en cuenta MP o en efectivo."
              : "No se pudo autorizar la tarjeta. Intentá con otra tarjeta o pagá con dinero en cuenta MP o en efectivo.";
          _toast(msg);
          setState(() => pagando = false);
          return;
        }

        _paymentId = authorization["payment_id"]?.toString();
        setState(() {
          pagoPreautorizadoGlobal = "preautorizado";
        });
        setState(() => pagando = false);
        await _solicitar();
        return;
      }

      final result = await Navigator.push<Map<String, dynamic>>(
        context,
        MaterialPageRoute(
          builder: (_) => PaymentCheckoutBrowserScreen(
            title: "Autorización segura",
            url: _paymentService.buildEmbeddedPaymentUrl(
              pacienteUuid: pacienteUuidGlobal,
              consultaId: consultaPreviaId!,
              monto: precio.toDouble(),
              tipo: "medico",
              motivo: motivoCtrl.text.trim().isEmpty
                  ? "Consulta médica DocYa"
                  : motivoCtrl.text.trim(),
            ),
            consultaId: consultaPreviaId,
          ),
        ),
      );

      final status = result?["status"]?.toString() ?? "cancelled";
      if (status != "success") {
        if (status == "cancelled") {
          _toast("Autorización cancelada");
        } else if (status == "pending") {
          _toast("El pago quedó pendiente de confirmación");
        } else {
          _toast("No se pudo autorizar el pago");
        }
        setState(() => pagando = false);
        return;
      }

      _paymentId = result!["payment_id"]?.toString();
      setState(() {
        pagoPreautorizadoGlobal = "preautorizado";
      });
      setState(() => pagando = false);
      await _solicitar();
      return;
    } catch (e) {
      final message = e.toString().replaceFirst('Exception: ', '').trim();
      _toast(message.isEmpty ? "Error al iniciar pago" : message);
    }

    setState(() => pagando = false);
  }

  // ============================================================
  // 💳 2. CONFIRMAR PAGO (DEEP LINK) + VERIFICACIÓN BACKEND
  // ============================================================
  // ============================================================
  // 🩺 3. CREAR CONSULTA FINAL (ASIGNACIÓN)
  // ============================================================
  Future<void> _solicitar() async {
    if (motivoCtrl.text.trim().isEmpty) {
      _toast("Completa el motivo");
      return;
    }
    if (!aceptaConsentimiento) {
      _toast("Debes aceptar la declaración jurada");
      return;
    }

    if (metodoPago == "efectivo") {
      return _solicitarEfectivo();
    }

    if (pagoPreautorizadoGlobal != "preautorizado" ||
        consultaPreviaId == null) {
      _toast("Debes completar el pago antes");
      return;
    }

    final body = jsonEncode({
      "consulta_id": consultaPreviaId,
      "paciente_uuid": pacienteUuidGlobal,
      "motivo": motivoCtrl.text.trim(),
      "direccion": _direccionActual,
      "lat": _ubicacionActual.latitude,
      "lng": _ubicacionActual.longitude,
      "metodo_pago": metodoPago == "saldo_mp" ? "saldo_mp" : "tarjeta",
      "payment_id": _paymentId ?? "",
      "tipo": "medico",
    });

    try {
      final res = await http.post(
        Uri.parse(
            "https://docya-railway-production.up.railway.app/consultas/solicitar"),
        headers: {"Content-Type": "application/json"},
        body: body,
      );

      if (res.statusCode != 200) {
        _toast("No se pudo iniciar la consulta");
        return;
      }

      final data = jsonDecode(res.body);

      final estado = data["estado"]?.toString();
      if (estado == "cancelada" ||
          estado == "pendiente_de_refund" ||
          estado == "sin_profesionales" ||
          estado == "sin_medicos" ||
          estado == "pago_no_autorizado") {
        _toast(
          (data["mensaje"] ?? "No encontramos profesionales disponibles.")
              .toString(),
        );
        return;
      }

      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => BuscandoMedicoScreen(
            direccion: _direccionActual,
            ubicacion: _ubicacionActual,
            motivo: motivoCtrl.text.trim(),
            consultaId: data["consulta_id"],
            pacienteUuid: pacienteUuidGlobal,
            paymentId: _paymentId ?? "",
            tipoProfesional: "medico",
          ),
        ),
      );
    } catch (_) {
      _toast("Error de conexión");
    }
  }

  // ============================================================
  // EFECTIVO — FLUJO ORIGINAL
  // ============================================================
  Future<void> _solicitarEfectivo() async {
    if (!await _confirmarDireccionAntesDeContinuar()) return;
    final body = jsonEncode({
      "paciente_uuid": pacienteUuidGlobal,
      "motivo": motivoCtrl.text.trim(),
      "direccion": _direccionActual,
      "lat": _ubicacionActual.latitude,
      "lng": _ubicacionActual.longitude,
      "metodo_pago": "efectivo",
      "payment_id": "",
      "tipo": "medico",
    });

    try {
      final res = await http.post(
        Uri.parse(
            "https://docya-railway-production.up.railway.app/consultas/solicitar"),
        headers: {"Content-Type": "application/json"},
        body: body,
      );

      final data = jsonDecode(res.body);

      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => BuscandoMedicoScreen(
            direccion: _direccionActual,
            ubicacion: _ubicacionActual,
            motivo: motivoCtrl.text.trim(),
            consultaId: data["consulta_id"],
            pacienteUuid: pacienteUuidGlobal,
            paymentId: "",
            tipoProfesional: "medico",
          ),
        ),
      );
    } catch (_) {
      _toast("Error");
    }
  }

  void _toast(String msg) {
    DocYaSnackbar.show(
      context,
      title: "Aviso",
      message: msg,
      type: SnackType.warning,
    );
  }

  String _formatPrecio(int? precio) {
    if (_cargandoTarifa) return "...";
    if (precio == null) return "Consultar";
    final value = precio.toString().replaceAllMapped(
          RegExp(r'\B(?=(\d{3})+(?!\d))'),
          (_) => '.',
        );
    return "\$$value";
  }

  Color _pageBg(bool isDark) =>
      isDark ? const Color(0xFF061D24) : const Color(0xFFF8FBFD);

  Color _surface(bool isDark) =>
      isDark ? const Color(0xFF0D2B34) : Colors.white;

  Color _textMain(bool isDark) =>
      isDark ? Colors.white : const Color(0xFF071238);

  Color _textSoft(bool isDark) =>
      isDark ? Colors.white70 : const Color(0xFF536078);

  void _selectService(int index) {
    setState(() {
      _selectedServiceIndex = index;
    });
  }

  Widget _logoHeader(bool isDark) {
    return Row(
      children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: _surface(isDark),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(isDark ? 0.18 : 0.06),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            color: _textMain(isDark),
            onPressed: () {
              if (_selectedServiceIndex != null) {
                setState(() => _selectedServiceIndex = null);
              } else {
                Navigator.pop(context);
              }
            },
          ),
        ),
        const Spacer(),
        Image.asset(
          isDark ? "assets/logoblanco.png" : "assets/logonegro.png",
          height: 48,
        ),
        const Spacer(),
        const SizedBox(width: 46),
      ],
    );
  }

  Widget _doctorAvatar({
    required double size,
    required bool isDark,
    required Color color,
  }) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color.withOpacity(isDark ? 0.20 : 0.12),
      ),
      child: Icon(Icons.person_rounded, size: size * 0.46, color: color),
    );
  }

  Widget _heroCard(bool isDark) {
    final service = _services.first;
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0EA896), Color(0xFF087C75)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0EA896).withOpacity(0.22),
            blurRadius: 24,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _doctorAvatar(size: 104, isDark: false, color: Colors.white),
              const SizedBox(width: 18),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Atencion medica",
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        height: 1.05,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      "Medicos a domicilio cuando mas lo necesitas.",
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        height: 1.35,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          Row(
            children: [
              const Icon(Icons.verified_user_rounded,
                  color: Colors.white, size: 30),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  "Profesionales\nverificados",
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    height: 1.25,
                  ),
                ),
              ),
              Container(width: 1, height: 34, color: Colors.white38),
              const SizedBox(width: 18),
              const Icon(Icons.speed_rounded, color: Colors.white, size: 30),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  "Atencion rapida\ny segura",
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    height: 1.25,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            service.badge,
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _serviceTile(
    _MedicalService service,
    int index,
    int? precio,
    bool isDark,
  ) {
    return InkWell(
      onTap: () => _selectService(index),
      borderRadius: BorderRadius.circular(22),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _surface(isDark),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFF0F9B91), width: 1.4),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(isDark ? 0.18 : 0.05),
              blurRadius: 18,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          children: [
            _doctorAvatar(size: 78, isDark: isDark, color: service.color),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    service.title,
                    style: TextStyle(
                      color: _textMain(isDark),
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    service.subtitle,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: _textSoft(isDark),
                      fontSize: 13.5,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Icon(Icons.schedule_rounded,
                          color: _textSoft(isDark), size: 18),
                      const SizedBox(width: 6),
                      Text(
                        service.duration,
                        style: TextStyle(
                          color: _textMain(isDark),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        _formatPrecio(precio),
                        style: const TextStyle(
                          color: Color(0xFF07877E),
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Icon(Icons.chevron_right_rounded, color: _textMain(isDark)),
          ],
        ),
      ),
    );
  }

  Widget _solvesCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _surface(isDark),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark ? Colors.white10 : const Color(0xFFE5EAF1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "¿Que podes resolver con una consulta?",
            style: TextStyle(
              color: _textMain(isDark),
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 14),
          ..._services.first.solves.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.check_circle_outline_rounded,
                      color: Color(0xFF0D9488), size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      item,
                      style: TextStyle(
                        color: _textMain(isDark),
                        fontSize: 14,
                        height: 1.25,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _verifiedStrip(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF18B7AD).withOpacity(isDark ? 0.12 : 0.08),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          const Icon(Icons.workspace_premium_rounded,
              color: Color(0xFF08786F), size: 30),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              "Todos nuestros medicos estan matriculados y verificados por DocYa.",
              style: TextStyle(
                color: _textMain(isDark),
                fontWeight: FontWeight.w700,
                height: 1.3,
              ),
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: _textMain(isDark)),
        ],
      ),
    );
  }

  Widget _detailHeader(_MedicalService service, int? precio, bool isDark) {
    return Column(
      children: [
        _doctorAvatar(size: 190, isDark: isDark, color: service.color),
        const SizedBox(height: 22),
        Text(
          service.title,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: _textMain(isDark),
            fontSize: 29,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: service.color.withOpacity(0.12),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Text(
            service.badge,
            style: TextStyle(
              color: service.color,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const SizedBox(height: 18),
        Text(
          service.subtitle,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: _textMain(isDark),
            fontSize: 16,
            height: 1.45,
          ),
        ),
        const SizedBox(height: 24),
        _detailInfoCard(service, precio, isDark),
      ],
    );
  }

  Widget _detailInfoCard(_MedicalService service, int? precio, bool isDark) {
    final rows = [
      (Icons.schedule_rounded, "Duracion estimada", service.duration),
      (Icons.sell_outlined, "Precio del servicio", _formatPrecio(precio)),
      (Icons.person_outline_rounded, "Profesional", "Medico/a matriculado/a"),
    ];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      decoration: BoxDecoration(
        color: _surface(isDark),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark ? Colors.white10 : const Color(0xFFE5EAF1),
        ),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 15),
              decoration: BoxDecoration(
                border: Border(
                  bottom: i == rows.length - 1
                      ? BorderSide.none
                      : BorderSide(
                          color:
                              isDark ? Colors.white10 : const Color(0xFFE8EDF3),
                        ),
                ),
              ),
              child: Row(
                children: [
                  Icon(rows[i].$1, color: _textMain(isDark), size: 28),
                  const SizedBox(width: 18),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          rows[i].$2,
                          style: TextStyle(
                            color: _textSoft(isDark),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          rows[i].$3,
                          style: TextStyle(
                            color: _textMain(isDark),
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _includedSection(_MedicalService service, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "¿Que incluye?",
          style: TextStyle(
            color: _textMain(isDark),
            fontSize: 17,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 12),
        ...service.includes.map(
          (item) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: const BoxDecoration(
                    color: Color(0xFF0D9488),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.check, color: Colors.white, size: 15),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    item,
                    style: TextStyle(
                      color: _textMain(isDark),
                      fontSize: 14.5,
                      height: 1.25,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _notesCard(_MedicalService service, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color:
            isDark ? Colors.white.withOpacity(0.06) : const Color(0xFFEFFAF7),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: isDark ? Colors.white10 : const Color(0xFFDCEFEA)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_rounded, color: Color(0xFF0D9488)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Tene en cuenta",
                  style: TextStyle(
                    color: _textMain(isDark),
                    fontWeight: FontWeight.w900,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 8),
                ...service.notes.map(
                  (note) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(
                      "• $note",
                      style: TextStyle(
                        color: _textMain(isDark),
                        height: 1.35,
                        fontSize: 13.5,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _howItWorks(bool isDark) {
    final steps = [
      (Icons.calendar_month_rounded, "Solicitas\nla consulta"),
      (Icons.person_search_rounded, "Asignamos\nal medico"),
      (Icons.location_on_outlined, "Te atiende\nen tu domicilio"),
      (Icons.payment_rounded, "Pagas\ndesde la app"),
    ];

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final step in steps) ...[
          Expanded(
            child: Column(
              children: [
                Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    color: _surface(isDark),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isDark ? Colors.white10 : const Color(0xFFE5EAF1),
                    ),
                  ),
                  child: Icon(step.$1, color: const Color(0xFF0E5B8E)),
                ),
                const SizedBox(height: 8),
                Text(
                  step.$2,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _textMain(isDark),
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    height: 1.2,
                  ),
                ),
              ],
            ),
          ),
          if (step != steps.last)
            Padding(
              padding: const EdgeInsets.only(top: 18),
              child: Icon(Icons.arrow_forward_rounded,
                  color: const Color(0xFF0D9488).withOpacity(0.8), size: 18),
            ),
        ],
      ],
    );
  }

  Widget _buildServiceListPage(bool isDark, int? precio) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 42),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _logoHeader(isDark),
          const SizedBox(height: 28),
          _heroCard(isDark),
          const SizedBox(height: 26),
          Text(
            "Elegi el tipo de consulta",
            style: TextStyle(
              color: _textMain(isDark),
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 14),
          _serviceTile(_services.first, 0, precio, isDark),
          const SizedBox(height: 26),
          _verifiedStrip(isDark),
          const SizedBox(height: 20),
          _solvesCard(isDark),
        ],
      ),
    );
  }

  Widget _buildServiceDetailPage(bool isDark, int? precio) {
    final service = _services[_selectedServiceIndex ?? 0];

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 80),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _logoHeader(isDark),
          const SizedBox(height: 24),
          _detailHeader(service, precio, isDark),
          const SizedBox(height: 26),
          _includedSection(service, isDark),
          const SizedBox(height: 18),
          _notesCard(service, isDark),
          const SizedBox(height: 24),
          Text(
            "¿Como funciona?",
            style: TextStyle(
              color: _textMain(isDark),
              fontWeight: FontWeight.w900,
              fontSize: 17,
            ),
          ),
          const SizedBox(height: 12),
          _howItWorks(isDark),
          const SizedBox(height: 22),
          _glassCard(_cardMotivo(isDark)),
          _glassCard(_cardPagoDigital(precio, isDark)),
          if (metodoPago == "tarjeta") _botonMP(),
          if (metodoPago == "saldo_mp") _botonSaldoMp(),
          _glassCard(_cardEfectivo(isDark)),
          if (metodoPago == "efectivo") ...[
            const SizedBox(height: 2),
            _botonSolicitar(isDark),
          ],
        ],
      ),
    );
  }

  // ============================================================
  // UI COMPLETA (NO TOCADA)
  // ============================================================
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final precio = _precioActual;

    return Scaffold(
      backgroundColor: _pageBg(isDark),
      body: Stack(
        children: [
          Container(
            decoration: BoxDecoration(
              gradient: isDark
                  ? const LinearGradient(
                      colors: [
                        Color(0xFF04151C),
                        Color(0xFF0C2530),
                        Color(0xFF133743),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    )
                  : const LinearGradient(
                      colors: [
                        Color(0xFFF7FBFB),
                        Colors.white,
                      ],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                    ),
            ),
          ),
          if (isDark) ...[
            Positioned(
              left: -120,
              top: 80,
              child: IgnorePointer(
                child: Container(
                  width: 280,
                  height: 280,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        Color.fromRGBO(20, 184, 166, 0.18),
                        Color.fromRGBO(20, 184, 166, 0.08),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              right: -150,
              top: 250,
              child: IgnorePointer(
                child: Container(
                  width: 340,
                  height: 340,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        Color.fromRGBO(45, 212, 191, 0.14),
                        Color.fromRGBO(45, 212, 191, 0.06),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
          SafeArea(
            child: _selectedServiceIndex == null
                ? _buildServiceListPage(isDark, precio)
                : _buildServiceDetailPage(isDark, precio),
          ),
        ],
      ),
    );
  }

  Widget _headerMedico(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFF0EA896),
                    Color(0xFF2DD4BF),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF14B8A6).withOpacity(0.24),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: const Icon(
                Icons.medical_services_rounded,
                size: 30,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                "Consulta médica a domicilio",
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: isDark ? Colors.white : Colors.black87,
                  height: 1.1,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: const Color(0xFF14B8A6).withOpacity(isDark ? 0.16 : 0.10),
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Text(
            "Solicitud médica",
            style: TextStyle(
              color: Color(0xFF14B8A6),
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          "Completás el motivo, autorizás el pago y DocYa empieza a buscar un médico cercano. Solo capturamos el cobro final cuando un profesional acepta tu pedido.",
          style: TextStyle(
            fontSize: 15,
            height: 1.45,
            color: isDark ? Colors.white70 : Colors.black54,
          ),
        ),
      ],
    );
  }

  Widget _pasosPago(bool isDark) {
    final pasos = [
      (
        icon: Icons.phone_iphone_rounded,
        color: const Color(0xFF009ee3),
        titulo: "Autorizás el pago dentro de DocYa",
        detalle:
            "Si es una tarjeta nueva, cargás los datos completos. Si ya estaba guardada, solo confirmás el CVV.",
      ),
      (
        icon: Icons.manage_search_rounded,
        color: const Color(0xFF14B8A6),
        titulo: "DocYa valida la reserva y busca médico",
        detalle:
            "Cuando la autorización queda lista, empezamos a asignarte un profesional.",
      ),
      (
        icon: Icons.verified_rounded,
        color: const Color(0xFF22C55E),
        titulo: "Solo se cobra si un médico acepta",
        detalle:
            "Si nadie acepta, anulamos la reserva y no te queda un cobro efectivo.",
      ),
    ];

    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color:
              isDark ? Colors.white.withOpacity(0.05) : const Color(0xFFF7FBFB),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: isDark
                ? Colors.white.withOpacity(0.12)
                : const Color(0xFF14B8A6).withOpacity(0.08),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "¿Cómo funciona?",
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 14),
            ...List.generate(pasos.length, (i) {
              final p = pasos[i];
              return Padding(
                padding: EdgeInsets.only(bottom: i < pasos.length - 1 ? 14 : 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      children: [
                        Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            color: p.color.withOpacity(0.12),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(p.icon, size: 18, color: p.color),
                        ),
                        if (i < pasos.length - 1)
                          Container(
                            width: 1.5,
                            height: 20,
                            margin: const EdgeInsets.symmetric(vertical: 3),
                            color: isDark ? Colors.white12 : Colors.black12,
                          ),
                      ],
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              p.titulo,
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w600,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              p.detalle,
                              style: TextStyle(
                                fontSize: 12,
                                height: 1.35,
                                color: isDark ? Colors.white54 : Colors.black45,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _saldoMpInfoRows(bool isDark) {
    final items = [
      (
        Icons.hourglass_empty_rounded,
        'No se cobra ahora',
        'El monto queda reservado en tu cuenta MP pero no debitado.'
      ),
      (
        Icons.check_circle_outline_rounded,
        'Se cobra solo si un medico acepta',
        'En el momento exacto que alguien acepta tu consulta.'
      ),
      (
        Icons.replay_rounded,
        'Si nadie acepta o cancelas',
        'El reintegro es casi instantaneo — vuelve a tu saldo MP en minutos.'
      ),
    ];
    return Column(
      children: items.map((item) {
        final (icon, titulo, detalle) = item;
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 18, color: const Color(0xFF00BCFF)),
              const SizedBox(width: 10),
              Expanded(
                child: RichText(
                  text: TextSpan(children: [
                    TextSpan(
                      text: '$titulo. ',
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    TextSpan(
                      text: detalle,
                      style: TextStyle(
                        color: isDark ? Colors.white60 : Colors.black54,
                        fontSize: 12.5,
                        height: 1.35,
                      ),
                    ),
                  ]),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _botonSaldoMp() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: ElevatedButton.icon(
        onPressed: pagando ? null : _pagarConSaldoMp,
        icon: pagando
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white))
            : const Icon(Icons.account_balance_wallet_rounded),
        label:
            Text(pagando ? 'Procesando...' : 'Pagar con saldo MP y solicitar'),
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(double.infinity, 54),
          backgroundColor: const Color(0xFF00BCFF),
          foregroundColor: Colors.white,
          textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          elevation: 0,
        ),
      ),
    );
  }

  Future<void> _pagarConSaldoMp() async {
    if (motivoCtrl.text.trim().isEmpty || !aceptaConsentimiento) {
      _toast('Completá el motivo y aceptá la declaración jurada.');
      return;
    }
    if (!await _confirmarDireccionAntesDeContinuar()) return;
    setState(() => pagando = true);
    try {
      final previa = await http.post(
        Uri.parse('$API_URL/consultas/crear_previa'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'paciente_uuid': pacienteUuidGlobal,
          'motivo': motivoCtrl.text.trim(),
          'direccion': _direccionActual,
          'lat': _ubicacionActual.latitude,
          'lng': _ubicacionActual.longitude,
          'tipo': 'medico',
        }),
      );
      if (previa.statusCode != 200) {
        _toast('No se pudo preparar la consulta.');
        setState(() => pagando = false);
        return;
      }
      consultaPreviaId = jsonDecode(previa.body)['consulta_id'];
      final precio = _precioActual;
      if (precio == null) {
        _toast('No se pudo cargar el precio.');
        setState(() => pagando = false);
        return;
      }

      final prefRes = await http.post(
        Uri.parse('$API_URL/pagos/saldo-mp/preferencia'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'paciente_uuid': pacienteUuidGlobal,
          'consulta_id': consultaPreviaId,
          'monto': precio.toDouble(),
          'motivo': motivoCtrl.text.trim().isEmpty
              ? 'Consulta médica DocYa'
              : motivoCtrl.text.trim(),
        }),
      );
      if (prefRes.statusCode != 200) {
        final err = jsonDecode(prefRes.body);
        _toast((err['detail']?['message'] ??
                err['message'] ??
                'Error al iniciar el pago')
            .toString());
        setState(() => pagando = false);
        return;
      }
      final initPoint =
          jsonDecode(prefRes.body)['init_point']?.toString() ?? '';
      if (initPoint.isEmpty) {
        _toast('No se pudo obtener la URL de pago.');
        setState(() => pagando = false);
        return;
      }

      if (!mounted) return;
      final result = await Navigator.push<Map<String, dynamic>>(
        context,
        MaterialPageRoute(
          builder: (_) => PaymentCheckoutBrowserScreen(
            title: 'Pagar con Mercado Pago',
            url: Uri.parse(initPoint),
            consultaId: consultaPreviaId,
          ),
        ),
      );

      final status = result?['status']?.toString() ?? 'cancelled';
      if (status != 'success') {
        _toast(status == 'cancelled'
            ? 'Pago cancelado'
            : 'No se pudo completar el pago');
        setState(() => pagando = false);
        return;
      }
      _paymentId = result!['payment_id']?.toString();
      pagoPreautorizadoGlobal = 'preautorizado';
      setState(() => pagando = false);
      await _solicitar();
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''));
      setState(() => pagando = false);
    }
  }

  Widget _glassCard(Widget child) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.all(22),
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withOpacity(0.08)
            : Colors.white.withOpacity(0.94),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark
              ? Colors.white.withOpacity(0.14)
              : const Color(0xFF14B8A6).withOpacity(0.08),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withOpacity(0.18)
                : const Color(0xFF14B8A6).withOpacity(0.08),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }

  Widget _cardMotivo(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _title("Motivo de la consulta", isDark),
        const SizedBox(height: 12),
        TextField(
          controller: motivoCtrl,
          maxLines: 4,
          style: TextStyle(color: isDark ? Colors.white : Colors.black87),
          decoration: InputDecoration(
            hintText:
                "Describí tus síntomas, evolución y cualquier dato importante...",
            hintStyle:
                TextStyle(color: isDark ? Colors.white54 : Colors.black45),
            filled: true,
            fillColor: isDark
                ? Colors.white.withOpacity(0.08)
                : const Color(0xFFF7FBFB),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(
                color: isDark
                    ? Colors.white30
                    : const Color(0xFF14B8A6).withOpacity(0.10),
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(
                color: isDark
                    ? Colors.white24
                    : const Color(0xFF14B8A6).withOpacity(0.10),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              value: aceptaConsentimiento,
              activeColor: Theme.of(context).colorScheme.primary,
              onChanged: (v) => setState(() => aceptaConsentimiento = v!),
            ),
            Expanded(
              child: Text(
                "Declaro haber respondido honestamente el triage previo.",
                style:
                    TextStyle(color: isDark ? Colors.white70 : Colors.black54),
              ),
            ),
          ],
        )
      ],
    );
  }

  Widget _cardPagoDigital(int? precio, bool isDark) {
    final primary = Theme.of(context).colorScheme.primary;
    final esSaldoMp = metodoPago == "saldo_mp";
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _precioCard(precio, isDark),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(
              child: _paymentTab(
                  value: "tarjeta",
                  icon: Icons.credit_card_rounded,
                  label: "Tarjeta de crédito",
                  isDark: isDark)),
          const SizedBox(width: 8),
          Expanded(
              child: _paymentTab(
                  value: "saldo_mp",
                  icon: Icons.account_balance_wallet_rounded,
                  label: "Saldo Mercado Pago",
                  isDark: isDark)),
        ]),
        const SizedBox(height: 16),
        Row(children: [
          Icon(Icons.lock_outline_rounded, color: primary, size: 18),
          const SizedBox(width: 8),
          Text("Pago con preautorizacion",
              style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 15,
                  fontWeight: FontWeight.w900)),
        ]),
        const SizedBox(height: 12),
        _pagoInfoRow(
            Icons.hourglass_empty_rounded,
            "No se cobra ahora",
            esSaldoMp
                ? "Con saldo MP se paga al confirmar y se reintegra si nadie acepta."
                : "El monto queda reservado en tu tarjeta pero no debitado.",
            isDark),
        const SizedBox(height: 8),
        _pagoInfoRow(
            Icons.check_circle_outline_rounded,
            "Se cobra solo si un médico acepta",
            "En el momento exacto que alguien acepta tu consulta.",
            isDark),
        const SizedBox(height: 8),
        _pagoInfoRow(
            Icons.replay_rounded,
            "Si nadie acepta o cancelas",
            esSaldoMp
                ? "El reintegro es casi instantaneo — vuelve a tu saldo MP en minutos."
                : "La reserva se libera sola en menos de 5 minutos. No perdes nada.",
            isDark),
        if (metodoPago == "tarjeta") ...[
          const SizedBox(height: 16),
          _savedCardsSection(isDark),
        ],
      ],
    );
  }

  Widget _cardEfectivo(bool isDark) {
    final selected = metodoPago == "efectivo";
    final primary = Theme.of(context).colorScheme.primary;
    return GestureDetector(
      onTap: () => setState(() => metodoPago = "efectivo"),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: selected
                  ? primary.withOpacity(0.14)
                  : (isDark
                      ? Colors.white.withOpacity(0.05)
                      : Colors.black.withOpacity(0.03)),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.attach_money_rounded,
                color: selected
                    ? primary
                    : (isDark ? Colors.white54 : Colors.black45)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text("Efectivo / Transferencia",
                  style: TextStyle(
                      color: isDark ? Colors.white : Colors.black87,
                      fontWeight: FontWeight.w700,
                      fontSize: 14)),
              const SizedBox(height: 2),
              Text("Pago directo al médico cuando llega o por transferencia.",
                  style: TextStyle(
                      color: isDark ? Colors.white54 : Colors.black45,
                      fontSize: 12.5,
                      height: 1.3)),
            ]),
          ),
          Radio<String>(
            value: "efectivo",
            groupValue: metodoPago,
            onChanged: (v) => setState(() => metodoPago = v!),
            activeColor: primary,
          ),
        ],
      ),
    );
  }

  Widget _paymentTab(
      {required String value,
      required IconData icon,
      required String label,
      required bool isDark}) {
    final selected = metodoPago == value;
    final primary = Theme.of(context).colorScheme.primary;
    return GestureDetector(
      onTap: () => setState(() => metodoPago = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: selected
              ? primary.withOpacity(0.14)
              : (isDark
                  ? Colors.white.withOpacity(0.04)
                  : Colors.black.withOpacity(0.03)),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected
                ? primary.withOpacity(0.55)
                : (isDark
                    ? Colors.white.withOpacity(0.09)
                    : Colors.black.withOpacity(0.07)),
            width: selected ? 1.4 : 1,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                size: 15,
                color: selected
                    ? primary
                    : (isDark ? Colors.white54 : Colors.black45)),
            const SizedBox(width: 6),
            Flexible(
                child: Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: selected
                    ? primary
                    : (isDark ? Colors.white54 : Colors.black45),
                fontSize: 11.5,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                height: 1.2,
              ),
            )),
          ],
        ),
      ),
    );
  }

  Widget _pagoInfoRow(
      IconData icon, String titulo, String detalle, bool isDark) {
    final primary = Theme.of(context).colorScheme.primary;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: primary),
        const SizedBox(width: 8),
        Expanded(
          child: RichText(
            text: TextSpan(children: [
              TextSpan(
                  text: '$titulo. ',
                  style: TextStyle(
                      color: isDark ? Colors.white : Colors.black87,
                      fontWeight: FontWeight.w800,
                      fontSize: 12.5)),
              TextSpan(
                  text: detalle,
                  style: TextStyle(
                      color: isDark ? Colors.white60 : Colors.black54,
                      fontSize: 12.5,
                      height: 1.35)),
            ]),
          ),
        ),
      ],
    );
  }

  Widget _precioCard(int? precio, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color:
            isDark ? Colors.white.withOpacity(0.08) : const Color(0xFFF7FBFB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark
              ? Colors.white24
              : const Color(0xFF14B8A6).withOpacity(0.08),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.monitor_heart_rounded,
              size: 32, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 16),
          Expanded(
            child: _cargandoTarifa
                ? const SizedBox(
                    height: 36,
                    child: Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : precio == null
                    ? Text(
                        "No se pudo cargar el precio",
                        style: TextStyle(
                          color: isDark ? Colors.white54 : Colors.black45,
                        ),
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "\$$precio",
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _descripcionPrecio,
                            style: TextStyle(
                              height: 1.3,
                              color: isDark ? Colors.white70 : Colors.black54,
                            ),
                          ),
                        ],
                      ),
          ),
        ],
      ),
    );
  }

  Widget _savedCardsSection(bool isDark) {
    if (_loadingSavedMethods) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }

    if (_savedMethods.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color:
              isDark ? Colors.white.withOpacity(0.05) : const Color(0xFFF7FBFB),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
        ),
        child: Text(
          "Todavia no tenes tarjetas reutilizables. La primera vez autorizas normal y despues podes usar una guardada con solo el codigo de seguridad.",
          style: TextStyle(
            color: isDark ? Colors.white70 : Colors.black54,
            height: 1.35,
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Tarjetas guardadas",
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          "Elegí una tarjeta guardada para validar solo el CVV. Si preferís otra, podés usar una tarjeta nueva.",
          style: TextStyle(
            fontSize: 12.5,
            height: 1.35,
            color: isDark ? Colors.white60 : Colors.black54,
          ),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: GestureDetector(
            onTap: () => setState(() => _selectedSavedMethod = null),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _selectedSavedMethod == null
                    ? const Color(0xFF14B8A6).withOpacity(0.12)
                    : (isDark
                        ? Colors.white.withOpacity(0.05)
                        : const Color(0xFFF7FBFB)),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: _selectedSavedMethod == null
                      ? const Color(0xFF14B8A6)
                      : (isDark ? Colors.white12 : Colors.black12),
                  width: _selectedSavedMethod == null ? 2 : 1,
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.add_card_rounded,
                    color: Color(0xFF14B8A6),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Usar una tarjeta nueva",
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          "Ingresá los datos completos. Si querés, después la dejamos lista para reutilizarla.",
                          style: TextStyle(
                            fontSize: 12.5,
                            color: isDark ? Colors.white70 : Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        ..._savedMethods.map((item) {
          final selected = _selectedSavedMethod?["id"] == item["id"];
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: GestureDetector(
              onTap: () => setState(() => _selectedSavedMethod = item),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: selected
                      ? const Color(0xFF009EE3).withOpacity(0.12)
                      : (isDark
                          ? Colors.white.withOpacity(0.05)
                          : const Color(0xFFF7FBFB)),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: selected
                        ? const Color(0xFF009EE3)
                        : (isDark ? Colors.white12 : Colors.black12),
                    width: selected ? 2 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.credit_card_rounded,
                        color: Color(0xFF009EE3)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _savedCardLabel(item),
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Vence ${_savedCardExpiration(item)} · Ya no tenés que escribir el número completo',
                            style: TextStyle(
                              fontSize: 12.5,
                              color: isDark ? Colors.white70 : Colors.black54,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _paymentOption({
    required String value,
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final selected = metodoPago == value;

    return GestureDetector(
      onTap: () => setState(() => metodoPago = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected
              ? color.withOpacity(0.12)
              : (isDark
                  ? Colors.white.withOpacity(0.06)
                  : const Color(0xFFF7FBFB)),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color:
                selected ? color : (isDark ? Colors.white24 : Colors.black26),
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, size: 26, color: color),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      )),
                  const SizedBox(height: 3),
                  Text(subtitle,
                      style: TextStyle(
                        color: isDark ? Colors.white70 : Colors.black54,
                        fontSize: 13,
                      )),
                ],
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                    color: selected ? color : Colors.white38, width: 2),
              ),
              child: selected
                  ? Container(
                      margin: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: color,
                      ),
                    )
                  : null,
            )
          ],
        ),
      ),
    );
  }

  Widget _botonMP() {
    return GestureDetector(
      onTap: pagando ? null : _pagar,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        height: 54,
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 20),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [
              Color(0xFF009EE3),
              Color(0xFF18B4F7),
            ],
          ),
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF009ee3).withOpacity(0.35),
              blurRadius: 16,
              offset: const Offset(0, 8),
            )
          ],
        ),
        child: Center(
          child: pagando
              ? const CircularProgressIndicator(
                  strokeWidth: 2, color: Colors.white)
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.lock_rounded, color: Colors.white),
                    const SizedBox(width: 10),
                    Text(
                      _selectedSavedMethod != null
                          ? "Autorizar y solicitar médico"
                          : "Autorizar y solicitar médico",
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _botonSolicitar(bool isDark) {
    final ready =
        metodoPago == "efectivo" || pagoPreautorizadoGlobal == "preautorizado";

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 200),
      opacity: ready ? 1 : 0.6,
      child: SizedBox(
        width: double.infinity,
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: ready
                  ? const [
                      Color(0xFF0EA896),
                      Color(0xFF14B8A6),
                      Color(0xFF2DD4BF),
                    ]
                  : [
                      Colors.grey.shade500,
                      Colors.grey.shade400,
                    ],
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: ready
                ? [
                    BoxShadow(
                      color: const Color(0xFF14B8A6).withOpacity(0.24),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ]
                : null,
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: ready ? _solicitar : null,
              child: const Padding(
                padding: EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.arrow_forward_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                    SizedBox(width: 10),
                    Text(
                      "Solicitar médico",
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _title(String t, bool isDark) {
    return Text(
      t,
      style: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: isDark ? Colors.white : Colors.black87,
      ),
    );
  }
}
