import json
import boto3
import os
import logging
import re
from datetime import datetime
from decimal import Decimal
from botocore.exceptions import ClientError, BotoCoreError

# Configuração de logging estruturado
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Instância global para reutilização entre invocações
processor = None


def lambda_handler(event, context):
    """
    Handler principal da Lambda function COM RASTREAMENTO UNIFICADO.
    """
    global processor
    session_attributes = {}

    try:
        # Inicializar processor se necessário
        if processor is None:
            processor = DentalClaimsProcessor()

        # GERAR OU RECUPERAR LEX_SESSION_ID ÚNICO
        session_attributes = event.get("sessionAttributes", {})
        lex_session_id = session_attributes.get("lexSessionId")

        if not lex_session_id:
            lex_session_id = f"lex_{datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}"
            session_attributes["lexSessionId"] = lex_session_id
            logger.info(
                "Novo lexSessionId gerado", extra={"lex_session_id": lex_session_id}
            )
        else:
            logger.info(
                "lexSessionId recuperado da sessão",
                extra={"lex_session_id": lex_session_id},
            )

        # Atualizar session attributes com o ID único
        event["sessionAttributes"] = session_attributes

        if "httpMethod" in event:
            # É uma chamada via API Gateway - converter resposta
            lex_response = processor.process_lex_event(event, context)
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps(lex_response),
            }
        else:
            # Chamada direta do Lex - retornar formato original
            return processor.process_lex_event(event, context)

    except Exception as e:
        logger.critical(
            "Erro crítico no handler principal",
            extra={
                "error_type": type(e).__name__,
                "error_message": str(e),
                "request_id": context.aws_request_id if context else "unknown",
            },
        )

        if "httpMethod" in event:
            # Formato API Gateway
            return {
                "statusCode": 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps(
                    {
                        "sessionAttributes": session_attributes,
                        "dialogAction": {
                            "type": "Close",
                            "fulfillmentState": "Failed",
                            "message": {
                                "contentType": "PlainText",
                                "content": "Erro crítico no sistema. Tente novamente mais tarde.",
                            },
                        },
                    }
                ),
            }
        else:

            return {
                "sessionAttributes": session_attributes,
                "dialogAction": {
                    "type": "Close",
                    "fulfillmentState": "Failed",
                    "message": {
                        "contentType": "PlainText",
                        "content": "Erro crítico no sistema. Tente novamente mais tarde.",
                    },
                },
            }


class DentalClaimsProcessor:
    """
    Classe principal para orquestrar o processamento de sinistros dentais.
    Coordena todos os managers e fluxos de processamento.
    """

    def __init__(self):
        """Inicializa todos os managers e valida configuração."""

        try:
            print("🔧 INICIANDO DentalClaimsProcessor...")

            self._validate_environment()
            print("✅ Environment validado")

            self.notification_manager = NotificationManager()
            print("✅ NotificationManager criado")

            self.document_processor = DocumentProcessor()
            print("✅ DocumentProcessor criado")

            self.ai_analyzer = AIAnalyzer()
            print("✅ AIAnalyzer criado")

            self.data_manager = DataManager()
            print("✅ DataManager criado")

            self.validator = ClaimValidator()
            print("✅ ClaimValidator criado")

            print("🔧 Criando FlowProcessor...")
            self.flow_processor = FlowProcessor(
                validator=self.validator,
                ai_analyzer=self.ai_analyzer,
                document_processor=self.document_processor,
                data_manager=self.data_manager,
                notification_manager=self.notification_manager,
            )
            print("✅ FlowProcessor criado")

            # self.sqs = boto3.client("sqs")
            # self.sqs_queue_url = os.environ["SQS_QUEUE_URL"]
            # print("✅ SQS configurado")

            logger.info("DentalClaimsProcessor inicializado com sucesso")
            print("🎉 DentalClaimsProcessor INICIALIZADO COM SUCESSO!")

        except Exception as e:
            print(f"💥 ERRO CRÍTICO NA INICIALIZAÇÃO: {type(e).__name__}: {str(e)}")
            import traceback

            print(f"💥 STACK TRACE: {traceback.format_exc()}")

            logger.error(
                "Falha na inicialização do DentalClaimsProcessor",
                extra={"error_type": type(e).__name__, "error_message": str(e)},
            )
            raise

    def _validate_environment(self):
        """Valida variáveis de ambiente obrigatórias."""
        required_vars = [
            "DYNAMO_TABLE",
            "DOCUMENTS_BUCKET",
            "SNS_TOPIC_CLIENTES",
            "SNS_TOPIC_DENTISTAS",
            "BEDROCK_MODEL_ID",
            # "SQS_QUEUE_URL",
        ]

        missing_vars = [var for var in required_vars if not os.environ.get(var)]
        if missing_vars:
            raise Exception(f"Variáveis de ambiente faltando: {missing_vars}")

        logger.info("Variáveis de ambiente validadas com sucesso")

    def process_lex_event(self, event, context):
        """
        Processa eventos do Amazon Lex com rastreamento unificado.

        Args:
            event: Dados do evento do Lex
            context: Contexto de execução Lambda

        Returns:
            dict: Resposta formatada para o Lex
        """
        try:

            print("📍 ETAPA 1: Início do método")

            event = self._parse_api_gateway_event(event)

            session_attributes = event.get("sessionAttributes", {})
            lex_session_id = session_attributes.get("lexSessionId", "unknown")

            print("📍 ETAPA 2: Session attributes OK")

            logger.info(
                "Processando evento do Lex",
                extra={
                    "request_id": context.aws_request_id,
                    "lex_session_id": lex_session_id,
                    "intent_name": event.get("currentIntent", {}).get(
                        "name", "unknown"
                    ),
                    "timestamp": datetime.utcnow().isoformat(),
                },
            )

            # Validar estrutura do evento
            if "currentIntent" not in event:
                logger.warning(
                    "Evento do Lex com estrutura inválida",
                    extra={"lex_session_id": lex_session_id},
                )
                print("❌ ETAPA 3: Evento inválido - currentIntent não encontrado")
                return self._build_error_response("Estrutura de evento inválida")

            print("📍 ETAPA 4: Evento válido")

            intent_name = event["currentIntent"]["name"]
            slots = event["currentIntent"].get("slots", {})

            print(f"📍 ETAPA 5: Intent name: {intent_name}")
            print(f"📍 ETAPA 6: Slots: {slots}")

            # Mascarar dados sensíveis para logging
            masked_slots = DataMasker.mask_sensitive_data(slots)
            logger.info(
                f"Processando intent: {intent_name}",
                extra={
                    "lex_session_id": lex_session_id,
                    "slots_masked": masked_slots,
                    "session_attributes_keys": list(session_attributes.keys()),
                },
            )

            # Roteamento de intenções
            print("📍 ETAPA 7: Iniciando roteamento de intenções")
            if intent_name == "SolicitarPreAprovacao":
                result = self.flow_processor.process_pre_approval_flow(
                    slots, session_attributes
                )
            elif intent_name == "SolicitarReembolso":
                result = self.flow_processor.process_reimbursement_flow(
                    slots, session_attributes
                )
            elif intent_name == "BuscarDentistas":
                result = self.flow_processor.process_dentist_search_flow(
                    slots, session_attributes
                )
            else:
                logger.warning(
                    f"Intenção não reconhecida: {intent_name}",
                    extra={"lex_session_id": lex_session_id},
                )
                result = self._build_error_response("Intenção não reconhecida")

            print(
                f"📍 ETAPA 8: Processamento concluído com sucesso. resultado: {result}"
            )

            # Log do resultado com lexSessionId
            logger.info(
                "Processamento concluído",
                extra={
                    "request_id": context.aws_request_id,
                    "lex_session_id": lex_session_id,
                    "result_status": result.get("status", "unknown"),
                    "processing_time_ms": context.get_remaining_time_in_millis(),
                },
            )

            return self._build_lex_response(result, session_attributes)

        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            lex_session_id = event.get("sessionAttributes", {}).get(
                "lexSessionId", "unknown"
            )
            logger.error(
                "Erro de serviço AWS",
                extra={
                    "lex_session_id": lex_session_id,
                    "error_code": error_code,
                    "error_message": e.response["Error"]["Message"],
                    "request_id": context.aws_request_id,
                },
            )
            return self._build_error_response(
                f"Erro temporário no serviço: {error_code}"
            )

        except Exception as e:

            print(f"💥 ERRO CAPTURADO: {type(e).__name__}: {str(e)}")
            import traceback

            print(f"💥 STACK TRACE: {traceback.format_exc()}")

            full_traceback = traceback.format_exc()

            logger.error(
                "Erro detalhado no processamento do evento Lex",
                extra={
                    "lex_session_id": session_attributes.get("lexSessionId", "unknown"),
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "full_traceback": full_traceback,
                    "event_data": str(event)[:500],
                },
            )

            return self._build_error_response("Erro interno do sistema")

    def _build_lex_response(self, result, session_attributes):
        """
        Constrói resposta formatada para o Amazon Lex.
        """
        try:
            status = result.get("status", "unknown")
            message = result.get("message", "Processamento concluído")

            # Mensagem detalhada baseada no status e dados
            detailed_message = self._build_detailed_message(result, status)

            response = {
                "sessionAttributes": session_attributes,
                "dialogAction": {
                    "type": "Close",
                    "fulfillmentState": (
                        "Fulfilled" if status == "success" else "Failed"
                    ),
                    "message": {
                        "contentType": "PlainText",
                        "content": detailed_message,
                    },
                },
            }

            return response

        except Exception as e:
            logger.error("Erro ao construir resposta Lex", extra={"error": str(e)})
            return self._build_error_response("Erro na construção da resposta")

    def _build_detailed_message(self, result, status):
        """
        Constrói mensagem detalhada baseada no resultado do processamento.
        """
        if status != "success":
            return result.get("message", "Erro no processamento")

        # Mensagem para pré-aprovação
        if "pre_approval" in result:
            pre_approval = result["pre_approval"]
            if pre_approval.get("approved"):
                return f"✅ Pré-aprovação CONCEDIDA! Cobertura: {pre_approval.get('coverage_percentage', 0)*100}%. Encontramos {len(result.get('clinics', []))} clínicas próximas."
            else:
                return f"🔍 Avaliação presencial necessária. Encontramos {len(result.get('clinics', []))} clínicas para sua avaliação."

        # Mensagem para reembolso
        if "reimbursement_result" in result:
            reimbursement = result["reimbursement_result"]
            return f"💰 {reimbursement.get('message', 'Processamento de reembolso concluído.')}"

        # Mensagem para busca de dentistas
        if "clinics" in result:
            return f"🏥 {result['message']}. Detalhes enviados para seu email."

        return result.get("message", "Processamento concluído com sucesso")

    def _build_error_response(self, message):
        """
        Constrói resposta de erro para o Lex.
        """
        return {
            "sessionAttributes": {},
            "dialogAction": {
                "type": "Close",
                "fulfillmentState": "Failed",
                "message": {"contentType": "PlainText", "content": f"❌ {message}"},
            },
        }

    def _parse_api_gateway_event(self, event):
        """
        Converte evento do API Gateway para formato Lex que o código espera.
        Inclui mapeamento de campos personalizados para o formato Lex.
        """
        try:
            # Verificar se é um evento do API Gateway
            if "httpMethod" in event and "body" in event:
                logger.info(
                    "📡 Evento do API Gateway detectado - convertendo para formato Lex"
                )

                # Parse do body JSON
                body_str = event["body"]

                # Se o body for string, converter para dict
                if isinstance(body_str, str):
                    try:
                        body_data = json.loads(body_str)
                    except json.JSONDecodeError as e:
                        logger.error(
                            "❌ Body não é JSON válido", extra={"error": str(e)}
                        )
                        return event
                else:
                    body_data = body_str

                # Log para debug - mostrar estrutura completa
                logger.info(
                    "📦 Estrutura do body recebido",
                    extra={
                        "body_keys": (
                            list(body_data.keys())
                            if isinstance(body_data, dict)
                            else "not_dict"
                        ),
                        "has_currentIntent": (
                            "currentIntent" in body_data
                            if isinstance(body_data, dict)
                            else False
                        ),
                    },
                )

                # ✅ CASO 1: Body já está no formato Lex - usar diretamente
                if isinstance(body_data, dict) and "currentIntent" in body_data:
                    logger.info("✅ Body já está no formato Lex - usando diretamente")
                    return body_data

                # ✅ CASO 2: Mapeamento de campos personalizados para formato Lex
                if isinstance(body_data, dict):
                    logger.info("🔄 Mapeando campos personalizados para formato Lex")

                    lex_event = {
                        "currentIntent": {
                            "name": "",
                            "slots": {},
                            "confirmationStatus": "None",
                        },
                        "sessionAttributes": {},
                        "invocationSource": "DialogCodeHook",
                    }

                    # Mapeamento de intent name
                    if "intent" in body_data:
                        lex_event["currentIntent"]["name"] = body_data["intent"]
                    elif "intentName" in body_data:
                        lex_event["currentIntent"]["name"] = body_data["intentName"]
                    elif "action" in body_data:
                        lex_event["currentIntent"]["name"] = body_data["action"]
                    else:
                        # Tentar inferir da URL path
                        path = event.get("path", "")
                        if "pre-approval" in path:
                            lex_event["currentIntent"]["name"] = "SolicitarPreAprovacao"
                        elif "reimbursement" in path:
                            lex_event["currentIntent"]["name"] = "SolicitarReembolso"
                        elif "dentists" in path:
                            lex_event["currentIntent"]["name"] = "BuscarDentistas"

                    # Mapeamento de slots
                    if "slots" in body_data and isinstance(body_data["slots"], dict):
                        lex_event["currentIntent"]["slots"] = body_data["slots"]
                    else:
                        # Mapeamento de campos individuais para slots
                        slot_mapping = {
                            "sintomas": [
                                "symptoms",
                                "sintomas",
                                "descricao",
                                "description",
                            ],
                            "planoDental": [
                                "plan",
                                "plano",
                                "planoDental",
                                "insurance",
                            ],
                            "localizacao": [
                                "location",
                                "localizacao",
                                "cep",
                                "city",
                                "cidade",
                            ],
                            "documentKey": [
                                "document",
                                "documentKey",
                                "file",
                                "arquivo",
                            ],
                            "valorProcedimento": [
                                "value",
                                "valor",
                                "valorProcedimento",
                                "amount",
                            ],
                            "especialidade": [
                                "specialty",
                                "especialidade",
                                "treatment",
                            ],
                        }

                        for lex_slot, possible_keys in slot_mapping.items():
                            for key in possible_keys:
                                if key in body_data and body_data[key]:
                                    lex_event["currentIntent"]["slots"][lex_slot] = str(
                                        body_data[key]
                                    )
                                    break

                    # Mapeamento de session attributes
                    if "session" in body_data:
                        lex_event["sessionAttributes"] = body_data["session"]
                    elif "context" in body_data:
                        lex_event["sessionAttributes"] = body_data["context"]
                    elif "userId" in body_data:
                        lex_event["sessionAttributes"] = {"userId": body_data["userId"]}

                    logger.info(
                        "✅ Mapeamento concluído",
                        extra={
                            "intent_name": lex_event["currentIntent"]["name"],
                            "slots_mapeados": list(
                                lex_event["currentIntent"]["slots"].keys()
                            ),
                            "session_attrs": list(
                                lex_event["sessionAttributes"].keys()
                            ),
                        },
                    )

                    return lex_event

                logger.warning(
                    "⚠️ Body não é um dicionário - retornando evento original"
                )
                return event

            # Se não for API Gateway, retornar evento original
            return event

        except Exception as e:
            logger.error(
                "❌ Erro no parse do evento API Gateway", extra={"error": str(e)}
            )
            import traceback

            logger.error(f"❌ Stack trace: {traceback.format_exc()}")
            return event  # Fallback para evento original


class NotificationManager:
    """Gerencia todas as notificações para clientes e dentistas."""

    def __init__(self):
        self.sns = boto3.client("sns")
        self.sns_topic_clientes = os.environ["SNS_TOPIC_CLIENTES"]
        self.sns_topic_dentistas = os.environ["SNS_TOPIC_DENTISTAS"]
        logger.info("NotificationManager inicializado")

    def send_approval_notifications(self, slots, diagnosis, pre_approval, clinics):
        """Envia notificações de pré-aprovação para cliente e dentista."""
        try:
            client_success = self._send_client_approval(
                slots, diagnosis, pre_approval, clinics
            )
            dentist_success = self._send_dentist_approval(
                slots, diagnosis, pre_approval, clinics
            )

            logger.info(
                "Notificações de aprovação enviadas",
                extra={
                    "client_success": client_success,
                    "dentist_success": dentist_success,
                    "clinics_count": len(clinics),
                },
            )

            return {
                "client_notification_sent": client_success,
                "dentist_notification_sent": dentist_success,
            }

        except Exception as e:
            logger.error(
                "Erro ao enviar notificações de aprovação", extra={"error": str(e)}
            )
            return {
                "client_notification_sent": False,
                "dentist_notification_sent": False,
            }

    def _send_client_approval(self, slots, diagnosis, pre_approval, clinics):
        """Envia notificação de pré-aprovação para o cliente."""
        try:
            if pre_approval.get("approved", False):
                subject = "✅ Pré-Aprovação Concedida - IAmigos Dental"
                status_text = "CONCEDIDA"
            else:
                subject = "🔍 Avaliação Requerida - IAmigos Dental"
                status_text = "REQUER AVALIAÇÃO PRESENCIAL"

            message = self._build_client_approval_message(
                slots, diagnosis, pre_approval, clinics
            )

            response = self.sns.publish(
                TopicArn=self.sns_topic_clientes, Subject=subject, Message=message
            )

            logger.info(
                "Notificação para cliente enviada",
                extra={
                    "message_id": response["MessageId"],
                    "approval_status": status_text,
                },
            )

            return True

        except Exception as e:
            logger.error(
                "Erro ao enviar notificação para cliente", extra={"error": str(e)}
            )
            return False

    def _send_dentist_approval(self, slots, diagnosis, pre_approval, clinics):
        """Envia notificação de pré-aprovação para o dentista."""
        try:
            subject = f"🦷 Nova Pré-Aprovação - Plano {pre_approval.get('plan_tier', '').upper()}"
            message = self._build_dentist_approval_message(
                slots, diagnosis, pre_approval, clinics
            )

            response = self.sns.publish(
                TopicArn=self.sns_topic_dentistas, Subject=subject, Message=message
            )

            logger.info(
                "Notificação para dentista enviada",
                extra={
                    "message_id": response["MessageId"],
                    "plan_tier": pre_approval.get("plan_tier"),
                },
            )

            return True

        except Exception as e:
            logger.error(
                "Erro ao enviar notificação para dentista", extra={"error": str(e)}
            )
            return False

    def send_reimbursement_notification(self, slots, reimbursement_result):
        """Envia notificação de reembolso apenas para o cliente."""
        try:
            status = reimbursement_result.get("status", "error")

            if status == "approved":
                subject = "✅ Reembolso Aprovado - IAmigos Dental"
            elif status == "partial":
                subject = "⚠️ Reembolso Parcial - IAmigos Dental"
            else:
                subject = "❌ Reembolso - IAmigos Dental"

            message = self._build_reimbursement_message(reimbursement_result)

            response = self.sns.publish(
                TopicArn=self.sns_topic_clientes, Subject=subject, Message=message
            )

            logger.info(
                "Notificação de reembolso enviada",
                extra={
                    "message_id": response["MessageId"],
                    "status": status,
                    "amount": reimbursement_result.get("amount", 0),
                },
            )

            return True

        except Exception as e:
            logger.error(
                "Erro ao enviar notificação de reembolso", extra={"error": str(e)}
            )
            return False

    def _build_client_approval_message(self, slots, diagnosis, pre_approval, clinics):
        """Constrói mensagem amigável para o cliente."""
        primary_condition = diagnosis.get(
            "possible_conditions", ["Avaliação necessária"]
        )[0]
        coverage_percentage = pre_approval.get("coverage_percentage", 0) * 100

        message = f"""
        **Resultado da Sua Pré-Aprovação Dental**
        
        📊 **Status:** {"CONCEDIDA" if pre_approval.get('approved') else "REQUER AVALIAÇÃO"}
        📋 **Plano:** {pre_approval.get('plan_tier', 'Basic').title()}
        💰 **Cobertura:** {coverage_percentage}% do valor aprovado
        
        🩺 **Informações:**
        • Condição Identificada: {primary_condition}
        • Nível de Urgência: {diagnosis.get('urgency_level', 'não especificado').title()}
        
        🏥 **Próximos Passos:**
        {f'✅ **Procedimento pré-aprovado!** Agende sua consulta.' if pre_approval.get('approved') else '🔍 **Avaliação necessária:** Visite um dentista para avaliação presencial.'}
        
        📞 **Central IAmigos:** (11) 9999-9999
        """

        return message

    def _build_dentist_approval_message(self, slots, diagnosis, pre_approval, clinics):
        """Constrói mensagem técnica para o dentista."""
        message = f"""
        **NOVA SOLICITAÇÃO DE PRÉ-APROVAÇÃO DENTAL**
        
        📋 **INFORMAÇÕES:**
        • Plano: {pre_approval.get('plan_tier', '').upper()}
        • Urgência: {diagnosis.get('urgency_level', 'Não especificado').upper()}
        • Status: {"✅ APROVADA" if pre_approval.get('approved') else "⚠️ REQUER AVALIAÇÃO"}
        
        🩺 **CLÍNICAS:**
        • Sintomas: {slots.get('sintomas', 'Não informado')}
        • Condições: {', '.join(diagnosis.get('possible_conditions', ['Avaliação necessária']))}
        
        _Esta é uma mensagem automática do sistema IAmigos Dental_
        """

        return message

    def _build_reimbursement_message(self, reimbursement_result):
        """Constrói mensagem de reembolso para o cliente."""
        status = reimbursement_result.get("status", "error")
        amount = reimbursement_result.get("amount", 0.0)

        message = f"""
        **Resultado do Seu Pedido de Reembolso**
        
        **Status:** {status.upper()}
        **Valor Aprovado:** R$ {amount:.2f}
        **Cobertura:** {reimbursement_result.get('percentage', 0) * 100}%
        
        💡 **Informação:**
        {reimbursement_result.get('message', 'Processamento concluído.')}
        
        ⏱️ **Próximos Passos:**
        {f'O valor será creditado em até 5 dias úteis.' if status in ['approved', 'partial'] else 'Entre em contato com nosso suporte.'}
        
        📞 **Central IAmigos:** (11) 9999-9999
        """

        return message


class AIAnalyzer:
    """Responsável pela análise de sintomas usando Amazon Bedrock (Titan)."""

    def __init__(self):
        self.bedrock = boto3.client("bedrock-runtime")
        self.model_id = os.environ.get(
            "BEDROCK_MODEL_ID", "amazon.titan-text-express-v1"
        )
        logger.info(f"AIAnalyzer inicializado com modelo: {self.model_id}")

    def analyze_symptoms(self, symptoms_text, plan_tier):
        """
        Analisa sintomas usando Amazon Bedrock com modelo Titan.

        Args:
            symptoms_text: Descrição dos sintomas
            plan_tier: Tier do plano dental

        Returns:
            dict: Resultado da análise
        """
        try:
            prompt = self._build_titan_prompt(symptoms_text, plan_tier)

            logger.info(
                "Enviando solicitação para Bedrock Titan",
                extra={
                    "model_id": self.model_id,
                    "symptoms_length": len(symptoms_text),
                },
            )

            # Configuração para Titan
            body = {
                "inputText": prompt,
                "textGenerationConfig": {
                    "maxTokenCount": 500,
                    "temperature": 0.3,
                    "topP": 0.9,
                },
            }

            response = self.bedrock.invoke_model(
                modelId=self.model_id, body=json.dumps(body)
            )

            response_body = json.loads(response["body"].read())
            analysis_text = response_body.get("results", [{}])[0].get("outputText", "")

            # Processar resposta do Titan
            analysis_result = self._parse_titan_response(analysis_text)

            logger.info(
                "Análise Bedrock concluída",
                extra={
                    "urgency": analysis_result.get("urgency_level"),
                    "conditions_count": len(
                        analysis_result.get("possible_conditions", [])
                    ),
                },
            )

            return analysis_result

        except ClientError as e:
            logger.error(
                "Erro no Bedrock Titan",
                extra={
                    "error_code": e.response["Error"]["Code"],
                    "model_id": self.model_id,
                },
            )
            return {"error": "bedrock_service_error"}
        except Exception as e:
            logger.error(
                "Erro inesperado no Bedrock",
                extra={"error_type": type(e).__name__, "error_message": str(e)},
            )
            return {"error": "unexpected_error"}

    def _build_titan_prompt(self, symptoms_text, plan_tier):
        """Constrói prompt específico para o modelo Titan."""
        prompt = f"""
        Como especialista dental, analise estes sintomas para pré-triagem:

        SINTOMAS: {symptoms_text}
        PLANO: {plan_tier}

        Forneça uma análise em formato JSON com estas chaves:
        - "possible_conditions": lista de possíveis condições (máx 3)
        - "urgency_level": "baixa", "media" ou "alta" 
        - "recommended_actions": lista de ações recomendadas
        - "coverage_probability": "alta", "media" ou "baixa"
        - "estimated_complexity": "simples", "moderado" ou "complexo"

        Mantenha a resposta em português e seja conservativo nas recomendações.
        Retorne APENAS o JSON, sem texto adicional.
        """

        return prompt

    def _parse_titan_response(self, response_text):
        """
        Analisa a resposta do modelo Titan para extrair JSON.

        Args:
            response_text: Texto de resposta do Titan

        Returns:
            dict: Dados estruturados da análise
        """
        try:
            # Tentar extrair JSON da resposta
            json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                # Fallback: criar estrutura básica
                logger.warning("Não foi possível extrair JSON da resposta Titan")
                return {
                    "possible_conditions": ["Avaliação necessária"],
                    "urgency_level": "media",
                    "recommended_actions": ["Consulta de avaliação"],
                    "coverage_probability": "media",
                    "estimated_complexity": "moderado",
                }

        except json.JSONDecodeError as e:
            logger.error("Erro ao decodificar JSON do Titan", extra={"error": str(e)})
            return {"error": "invalid_json_response"}


class DataManager:
    """Gerencia todas as operações de persistência no DynamoDB."""

    def __init__(self):
        self.dynamodb = boto3.resource("dynamodb")
        self.table_name = os.environ["DYNAMO_TABLE"]
        self.table = self.dynamodb.Table(self.table_name)
        logger.info("DataManager inicializado")

    def save_pre_approval_claim(self, claim_data, session_attributes):
        """
        Salva dados de pré-aprovação no DynamoDB com rastreamento unificado.
        """
        try:
            lex_session_id = session_attributes.get(
                "lexSessionId", f"lex_{datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}"
            )

            item = {
                "sessionId": lex_session_id,
                "claimType": "pre_approval",
                "processStep": "symptoms_analysis",
                "createdAt": datetime.utcnow().isoformat(),
                "symptoms": claim_data["symptoms"],
                "planTier": claim_data["plan_tier"],
                "location": claim_data["location"],
                "diagnosis": claim_data["diagnosis"],
                "preApproval": claim_data["pre_approval"],
                "clinics": claim_data["clinics"],
                "status": "processed",
                "notificationTopics": {
                    "clientes": os.environ["SNS_TOPIC_CLIENTES"],
                    "dentistas": os.environ["SNS_TOPIC_DENTISTAS"],
                },
            }

            response = self.table.put_item(Item=item)

            logger.info(
                "Pré-aprovação salva com rastreamento unificado",
                extra={
                    "lex_session_id": lex_session_id,
                    "process_step": "symptoms_analysis",
                    "plan_tier": claim_data["plan_tier"],
                    "dynamo_status": response["ResponseMetadata"]["HTTPStatusCode"],
                },
            )

            return True

        except Exception as e:
            logger.error(
                "Erro ao salvar pré-aprovação",
                extra={
                    "lex_session_id": session_attributes.get("lexSessionId", "unknown"),
                    "error": str(e),
                },
            )
            return False

    def save_reimbursement_claim(self, claim_data, session_attributes):
        """
        Salva dados de reembolso no DynamoDB com rastreamento unificado.
        """
        try:
            lex_session_id = session_attributes.get(
                "lexSessionId", f"lex_{datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}"
            )

            reimbursement_result = claim_data.get("reimbursement_result", {})

            item = {
                "sessionId": lex_session_id,
                "claimType": "reimbursement",
                "processStep": "document_processing",
                "createdAt": datetime.utcnow().isoformat(),
                "documentKey": claim_data.get("document_key", ""),
                "planTier": claim_data.get("plan_tier", "basic"),
                "procedureValue": Decimal(str(claim_data.get("procedure_value", 0.0))),
                "reimbursementResult": reimbursement_result,
                "status": reimbursement_result.get("status", "pending"),
                "reimbursementAmount": Decimal(
                    str(reimbursement_result.get("amount", 0.0))
                ),
                "notificationTopics": {
                    "clientes": os.environ["SNS_TOPIC_CLIENTES"],
                    "dentistas": "none",
                },
            }

            # Adicionar dados do documento de forma segura
            if "document_data" in claim_data:
                safe_document_data = {
                    "total_amount": claim_data["document_data"].get("total_amount"),
                    "date": claim_data["document_data"].get("date"),
                    "provider_name": claim_data["document_data"].get(
                        "provider_name", ""
                    )[:50]
                    + "...",
                    "fields_count": len(claim_data["document_data"]),
                }
                item["documentData"] = safe_document_data

            response = self.table.put_item(Item=item)

            logger.info(
                "Reembolso salvo com rastreamento unificado",
                extra={
                    "lex_session_id": lex_session_id,
                    "process_step": "document_processing",
                    "status": reimbursement_result.get("status", "unknown"),
                    "amount": float(reimbursement_result.get("amount", 0.0)),
                    "dynamo_status": response["ResponseMetadata"]["HTTPStatusCode"],
                },
            )

            return True

        except Exception as e:
            logger.error(
                "Erro ao salvar reembolso",
                extra={
                    "lex_session_id": session_attributes.get("lexSessionId", "unknown"),
                    "error": str(e),
                },
            )
            return False

    def save_search_record(self, search_data, session_attributes):
        """
        Salva registro de busca de dentistas no DynamoDB com rastreamento unificado.
        """
        try:
            lex_session_id = session_attributes.get(
                "lexSessionId", f"lex_{datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}"
            )

            item = {
                "sessionId": lex_session_id,
                "claimType": "dentist_search",
                "processStep": "clinic_search",
                "createdAt": datetime.utcnow().isoformat(),
                "location": search_data.get("location", ""),
                "planTier": search_data.get("plan_tier", "basic"),
                "specialty": search_data.get("specialty", "geral"),
                "dentistsFound": search_data.get("dentists_found", 0),
                "status": "completed",
            }

            self.table.put_item(Item=item)

            logger.info(
                "Busca salva com rastreamento unificado",
                extra={
                    "lex_session_id": lex_session_id,
                    "process_step": "clinic_search",
                    "dentists_found": search_data.get("dentists_found", 0),
                    "location": search_data.get("location", "")[:50],
                },
            )

            return True

        except Exception as e:
            logger.error(
                "Erro ao salvar busca",
                extra={
                    "lex_session_id": session_attributes.get("lexSessionId", "unknown"),
                    "error": str(e),
                },
            )
            return False


class DocumentProcessor:
    """Processa documentos usando Amazon Textract para extração de dados."""

    def __init__(self):
        self.textract = boto3.client("textract")
        self.documents_bucket = os.environ["DOCUMENTS_BUCKET"]
        logger.info("DocumentProcessor inicializado")

    def process_receipt(self, document_key):
        """
        Processa recibo/nota fiscal usando Textract.

        Args:
            document_key: Chave do documento no S3

        Returns:
            dict: Dados extraídos do documento
        """
        try:
            logger.info(
                "Iniciando análise de documento com Textract",
                extra={"document_key": document_key},
            )

            response = self.textract.analyze_expense(
                Document={
                    "S3Object": {"Bucket": self.documents_bucket, "Name": document_key}
                }
            )

            extracted_data = self._extract_expense_data(response)

            logger.info(
                "Análise Textract concluída",
                extra={
                    "fields_extracted": len(extracted_data),
                    "has_amount": "total_amount" in extracted_data,
                },
            )

            return extracted_data

        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            logger.error(
                "Erro no Textract",
                extra={
                    "error_code": error_code,
                    "document_key": document_key,
                },
            )

            if error_code == "InvalidParameterException":
                return {"error": "invalid_document_format"}
            else:
                return {"error": "textract_service_error"}

        except Exception as e:
            logger.error(
                "Erro inesperado no Textract",
                extra={"error_type": type(e).__name__, "error_message": str(e)},
            )
            return {"error": "unexpected_error"}

    def _extract_expense_data(self, textract_response):
        """
        Extrai dados estruturados da resposta do Textract.

        Args:
            textract_response: Resposta da API Textract

        Returns:
            dict: Dados extraídos do documento
        """
        extracted_data = {}

        try:
            for expense_doc in textract_response.get("ExpenseDocuments", []):
                for summary_field in expense_doc.get("SummaryFields", []):
                    field_type = summary_field.get("Type", {}).get("Text", "").lower()
                    field_text = summary_field.get("ValueDetection", {}).get("Text", "")

                    # Mapear campos relevantes
                    if "total" in field_type or "amount" in field_type:
                        extracted_data["total_amount"] = self._extract_currency_value(
                            field_text
                        )
                    elif "date" in field_type:
                        extracted_data["date"] = field_text
                    elif "vendor" in field_type or "provider" in field_type:
                        extracted_data["provider_name"] = field_text
                    elif "description" in field_type:
                        extracted_data["procedure_description"] = field_text
                    elif "tax" in field_type:
                        extracted_data["tax_amount"] = self._extract_currency_value(
                            field_text
                        )

            logger.info(
                "Dados extraídos do documento",
                extra={"extracted_fields": list(extracted_data.keys())},
            )

            return extracted_data

        except Exception as e:
            logger.error(
                "Erro na extração de dados do Textract", extra={"error": str(e)}
            )
            return {"error": "data_extraction_failed"}

    def _extract_currency_value(self, text):
        """
        Extrai valor numérico de string de moeda.

        Args:
            text: Texto contendo valor monetário

        Returns:
            float: Valor numérico extraído
        """
        try:
            if not text:
                return 0.0

            # Remover caracteres não numéricos exceto ponto e vírgula
            clean_text = re.sub(r"[^\d,.]", "", text)

            # Converter para float
            if "," in clean_text and "." in clean_text:
                # Formato: 1.000,00 -> 1000.00
                clean_text = clean_text.replace(".", "").replace(",", ".")
            elif "," in clean_text:
                # Formato: 1000,00 -> 1000.00
                clean_text = clean_text.replace(",", ".")

            return float(clean_text) if clean_text else 0.0

        except (ValueError, TypeError) as e:
            logger.warning(
                "Erro ao extrair valor monetário",
                extra={"original_text": text, "error": str(e)},
            )
            return 0.0


class ClaimValidator:
    """Responsável por todas as validações de dados e regras de negócio."""

    def __init__(self):
        logger.info("ClaimValidator inicializado")

    def validate_pre_approval_slots(self, slots):
        """
        Valida slots obrigatórios para pré-aprovação.

        Args:
            slots: Slots do Lex

        Returns:
            dict: Resultado da validação
        """
        required_fields = ["sintomas", "planoDental", "localizacao"]
        missing_fields = [field for field in required_fields if not slots.get(field)]

        if missing_fields:
            logger.warning(
                "Campos obrigatórios faltando para pré-aprovação",
                extra={"missing_fields": missing_fields},
            )
            return {
                "valid": False,
                "response": {
                    "status": "missing_required_fields",
                    "message": f'Por favor, informe: {", ".join(missing_fields)}',
                },
            }

        return {"valid": True, "response": None}

    def validate_reimbursement_slots(self, slots):
        """
        Valida slots obrigatórios para reembolso.

        Args:
            slots: Slots do Lex

        Returns:
            dict: Resultado da validação
        """
        required_fields = ["documentKey", "planoDental", "valorProcedimento"]
        missing_fields = [field for field in required_fields if not slots.get(field)]

        if missing_fields:
            logger.warning(
                "Campos obrigatórios faltando para reembolso",
                extra={"missing_fields": missing_fields},
            )
            return {
                "valid": False,
                "response": {
                    "status": "missing_required_fields",
                    "message": f'Para reembolso, preciso de: {", ".join(missing_fields)}',
                },
            }

        # Validar formato do valor
        try:
            float(slots["valorProcedimento"])
        except (ValueError, TypeError):
            return {
                "valid": False,
                "response": {
                    "status": "invalid_value",
                    "message": "Valor do procedimento inválido",
                },
            }

        return {"valid": True, "response": None}

    def validate_reimbursement_data(self, document_data, claimed_value, plan_tier):
        """
        Valida dados extraídos para reembolso.

        Args:
            document_data: Dados extraídos do documento
            claimed_value: Valor declarado pelo usuário
            plan_tier: Tier do plano

        Returns:
            dict: Resultado da validação
        """
        errors = []
        warnings = []

        try:
            # Validar valor total
            document_amount = document_data.get("total_amount", 0)
            if document_amount <= 0:
                errors.append("Valor total não identificado no documento")
            elif abs(document_amount - claimed_value) > 10.0:  # Tolerância de R$ 10
                warnings.append(f"Valor declarado difere do documento")

            # Validar data
            if not document_data.get("date"):
                warnings.append("Data não identificada no documento")

            # Validar nome do provedor
            if not document_data.get("provider_name"):
                warnings.append("Nome do dentista/clínica não identificado")

            logger.info(
                "Validação de dados de reembolso concluída",
                extra={
                    "errors_count": len(errors),
                    "warnings_count": len(warnings),
                    "document_amount": document_amount,
                    "claimed_value": claimed_value,
                },
            )

            return {
                "valid": len(errors) == 0,
                "errors": errors,
                "warnings": warnings,
                "document_amount": document_amount,
            }

        except Exception as e:
            logger.error(
                "Erro na validação de dados de reembolso", extra={"error": str(e)}
            )
            return {
                "valid": False,
                "errors": ["Erro na validação dos dados"],
                "warnings": [],
                "document_amount": 0,
            }

    def check_plan_coverage(self, diagnosis, plan_tier):
        """
        Verifica cobertura do plano baseado no diagnóstico.

        Args:
            diagnosis: Resultado da análise do Bedrock
            plan_tier: Tier do plano dental

        Returns:
            dict: Resultado da verificação de cobertura
        """
        try:
            # Regras de cobertura por plano
            coverage_rules = {
                "basic": {
                    "covered_conditions": ["consulta", "profilaxia", "radiografia"],
                    "max_coverage": 300.00,
                    "coverage_percentage": 0.7,
                },
                "premium": {
                    "covered_conditions": [
                        "consulta",
                        "profilaxia",
                        "radiografia",
                        "restauracao",
                        "extracao",
                    ],
                    "max_coverage": 1000.00,
                    "coverage_percentage": 0.9,
                },
            }

            plan_rules = coverage_rules.get(plan_tier, coverage_rules["basic"])
            urgency = diagnosis.get("urgency_level", "baixa")
            complexity = diagnosis.get("estimated_complexity", "simples")

            # Lógica simplificada de aprovação
            approved = (
                urgency != "alta"  # Planos básicos não cobrem urgências altas
                or plan_tier == "premium"
            ) and complexity != "complexo"

            coverage_info = {
                "approved": approved,
                "plan_tier": plan_tier,
                "coverage_percentage": plan_rules["coverage_percentage"],
                "max_coverage": plan_rules["max_coverage"],
                "urgency_level": urgency,
                "complexity": complexity,
            }

            logger.info(
                "Verificação de cobertura concluída",
                extra={
                    "approved": approved,
                    "plan_tier": plan_tier,
                    "urgency": urgency,
                },
            )

            return coverage_info

        except Exception as e:
            logger.error(
                "Erro na verificação de cobertura",
                extra={"error": str(e), "plan_tier": plan_tier},
            )
            return {"approved": False, "error": "coverage_check_failed"}


class FlowProcessor:
    """Responsável por orquestrar os fluxos específicos de negócio."""

    def __init__(
        self,
        validator,
        ai_analyzer,
        document_processor,
        data_manager,
        notification_manager,
    ):
        self.validator = validator
        self.ai_analyzer = ai_analyzer
        self.document_processor = document_processor
        self.data_manager = data_manager
        self.notification_manager = notification_manager
        logger.info("FlowProcessor inicializado")

    def process_pre_approval_flow(self, slots, session_attributes):
        """Processa fluxo completo de pré-aprovação."""
        try:
            # Validação
            validation_result = self.validator.validate_pre_approval_slots(slots)
            if not validation_result["valid"]:
                return validation_result["response"]

            # Extração
            symptoms = slots["sintomas"]
            plan_tier = slots["planoDental"]
            location = slots["localizacao"]

            # Análise IA
            diagnosis = self.ai_analyzer.analyze_symptoms(symptoms, plan_tier)
            if diagnosis.get("error"):
                return self._build_error_response(
                    "analysis_error", "Erro na análise dos sintomas"
                )

            # Cobertura
            pre_approval = self.validator.check_plan_coverage(diagnosis, plan_tier)
            if pre_approval.get("error"):
                return self._build_error_response(
                    "coverage_error", "Erro na verificação de cobertura"
                )

            # Clínicas
            clinics = self._find_nearby_clinics(location, plan_tier)

            # Persistência
            claim_data = {
                "symptoms": symptoms,
                "plan_tier": plan_tier,
                "location": location,
                "diagnosis": diagnosis,
                "pre_approval": pre_approval,
                "clinics": clinics,
            }
            self.data_manager.save_pre_approval_claim(claim_data, session_attributes)

            # Notificações
            notification_result = self.notification_manager.send_approval_notifications(
                slots, diagnosis, pre_approval, clinics
            )

            return self._build_success_response(
                "Pré-aprovação processada com sucesso",
                {
                    "diagnosis": diagnosis,
                    "pre_approval": pre_approval,
                    "clinics": clinics,
                    "notifications": notification_result,
                },
            )

        except Exception as e:
            logger.error("Erro no fluxo de pré-aprovação", extra={"error": str(e)})
            return self._build_error_response(
                "processing_error", "Erro no processamento"
            )

    def process_reimbursement_flow(self, slots, session_attributes):
        """Processa fluxo completo de reembolso."""
        try:
            # Validação
            validation_result = self.validator.validate_reimbursement_slots(slots)
            if not validation_result["valid"]:
                return validation_result["response"]

            # Extração
            document_key = slots["documentKey"]
            plan_tier = slots["planoDental"]
            procedure_value = float(slots["valorProcedimento"])

            # Processamento documento
            document_data = self.document_processor.process_receipt(document_key)
            if document_data.get("error"):
                return self._build_error_response(
                    "document_error", "Erro no processamento do documento"
                )

            # Validação dados
            validation_result = self.validator.validate_reimbursement_data(
                document_data, procedure_value, plan_tier
            )
            if not validation_result["valid"]:
                return self._build_error_response(
                    "validation_failed",
                    f"Dados inválidos: {', '.join(validation_result['errors'])}",
                )

            # Cálculo reembolso
            reimbursement_result = self._calculate_reimbursement(
                validation_result["document_amount"], plan_tier, validation_result
            )

            # Persistência
            claim_data = {
                "document_key": document_key,
                "plan_tier": plan_tier,
                "procedure_value": procedure_value,
                "document_data": document_data,
                "reimbursement_result": reimbursement_result,
            }
            self.data_manager.save_reimbursement_claim(claim_data, session_attributes)

            # Notificação
            self.notification_manager.send_reimbursement_notification(
                slots, reimbursement_result
            )

            return self._build_success_response(
                "Reembolso processado com sucesso",
                {
                    "reimbursement_result": reimbursement_result,
                    "validation_warnings": validation_result.get("warnings", []),
                },
            )

        except Exception as e:
            logger.error("Erro no fluxo de reembolso", extra={"error": str(e)})
            return self._build_error_response(
                "processing_error", "Erro no processamento"
            )

    def process_dentist_search_flow(self, slots, session_attributes):
        """Processa busca de dentistas."""
        try:
            location = slots.get("localizacao", "")
            plan_tier = slots.get("planoDental", "basic")
            specialty = slots.get("especialidade", "geral")

            # Busca
            clinics = self._find_nearby_clinics(location, plan_tier, specialty)

            # Persistência
            search_data = {
                "location": location,
                "plan_tier": plan_tier,
                "specialty": specialty,
                "dentists_found": len(clinics),
            }
            self.data_manager.save_search_record(search_data, session_attributes)

            return self._build_success_response(
                f"Encontrados {len(clinics)} dentistas",
                {"clinics": clinics, "search_params": search_data},
            )

        except Exception as e:
            logger.error("Erro na busca de dentistas", extra={"error": str(e)})
            return self._build_error_response("search_error", "Erro na busca")

    def _find_nearby_clinics(self, location, plan_tier, specialty="geral"):
        """Busca clínicas próximas (dados fictícios)."""
        mock_clinics = [
            {
                "name": "Clínica Dental Sorriso Saudável",
                "address": "Rua Principal, 123 - Centro",
                "phone": "(11) 3333-4444",
                "specialties": ["geral", "ortodontia"],
                "accepted_plans": ["basic", "premium"],
                "distance": "1.2 km",
            }
            # ... outros clinics
        ]

        return [
            clinic
            for clinic in mock_clinics
            if plan_tier in clinic["accepted_plans"]
            and (specialty == "geral" or specialty in clinic["specialties"])
        ][:5]

    def _calculate_reimbursement(self, document_amount, plan_tier, validation_result):
        """Calcula valor do reembolso."""
        reimbursement_rules = {
            "basic": {"percentage": 0.7, "max_amount": 300.00},
            "premium": {"percentage": 0.9, "max_amount": 1000.00},
        }

        rules = reimbursement_rules.get(plan_tier, reimbursement_rules["basic"])
        base_amount = document_amount * rules["percentage"]
        final_amount = min(base_amount, rules["max_amount"])

        if validation_result.get("warnings"):
            final_amount *= 0.9

        status = "approved" if final_amount > 0 else "rejected"
        if final_amount < base_amount:
            status = "partial"

        return {
            "status": status,
            "amount": round(final_amount, 2),
            "percentage": rules["percentage"],
            "original_amount": document_amount,
            "max_allowed": rules["max_amount"],
            "message": self._get_reimbursement_message(status, final_amount),
        }

    def _get_reimbursement_message(self, status, amount):
        """Gera mensagem do reembolso."""
        messages = {
            "approved": f"Reembolso aprovado no valor de R$ {amount:.2f}",
            "partial": f"Reembolso parcial aprovado no valor de R$ {amount:.2f}",
            "rejected": "Reembolso não aprovado conforme regras do plano",
        }
        return messages.get(status, "Status desconhecido")

    def _build_success_response(self, message, data=None):
        """Constrói resposta de sucesso padronizada."""
        return {"status": "success", "message": message, "data": data or {}}

    def _build_error_response(self, error_type, message):
        """Constrói resposta de erro padronizada."""
        return {"status": error_type, "message": message}


class DataMasker:
    """Responsável por mascaramento de dados sensíveis para logging e segurança."""

    @staticmethod
    def mask_sensitive_data(slots):
        """
        Mascara dados sensíveis para logging de forma segura.

        Args:
            slots: Dicionário com slots do Lex contendo dados sensíveis

        Returns:
            dict: Slots com dados sensíveis mascarados
        """
        try:
            if not slots or not isinstance(slots, dict):
                return {}

            masked_slots = slots.copy()

            # Campos considerados sensíveis para mascaramento
            sensitive_fields = {
                "documentKey": DataMasker._mask_document_key,
                "cpf": DataMasker._mask_cpf,
                "email": DataMasker._mask_email,
                "phone": DataMasker._mask_phone,
                "planoDental": DataMasker._mask_generic,
                "valorProcedimento": DataMasker._mask_currency,
                "sintomas": DataMasker._mask_symptoms,
            }

            for field, mask_function in sensitive_fields.items():
                if field in masked_slots and masked_slots[field]:
                    try:
                        masked_slots[field] = mask_function(masked_slots[field])
                    except Exception as e:
                        logger.warning(
                            f"Erro ao mascarar campo {field}",
                            extra={
                                "error": str(e),
                                "field_type": type(masked_slots[field]).__name__,
                            },
                        )
                        masked_slots[field] = "***MASKING_ERROR***"

            return masked_slots

        except Exception as e:
            logger.error(
                "Erro crítico no mascaramento de dados", extra={"error": str(e)}
            )
            return {"error": "data_masking_failed"}

    @staticmethod
    def _mask_document_key(document_key):
        """Mascara chave de documento para logging."""
        if not document_key or not isinstance(document_key, str):
            return "***"

        if len(document_key) <= 8:
            return "***"

        return f"{document_key[:4]}...{document_key[-4:]}"

    @staticmethod
    def _mask_cpf(cpf):
        """Mascara CPF para logging."""
        if not cpf or not isinstance(cpf, str):
            return "***"

        clean_cpf = re.sub(r"[^\d]", "", cpf)

        if len(clean_cpf) != 11:
            return "***INVALID_CPF***"

        return f"***.{clean_cpf[3:6]}.{clean_cpf[6:9]}-**"

    @staticmethod
    def _mask_email(email):
        """Mascara email para logging."""
        if not email or not isinstance(email, str) or "@" not in email:
            return "***"

        parts = email.split("@")
        if len(parts) != 2:
            return "***"

        username, domain = parts
        if len(username) <= 2:
            masked_username = "*" * len(username)
        else:
            masked_username = f"{username[0]}***{username[-1]}"

        return f"{masked_username}@{domain}"

    @staticmethod
    def _mask_phone(phone):
        """Mascara telefone para logging."""
        if not phone or not isinstance(phone, str):
            return "***"

        clean_phone = re.sub(r"[^\d]", "", phone)

        if len(clean_phone) < 8:
            return "***"

        if len(clean_phone) == 11:
            return f"({clean_phone[:2]}) *****-{clean_phone[-4:]}"
        elif len(clean_phone) == 10:
            return f"({clean_phone[:2]}) ****-{clean_phone[-4:]}"
        else:
            return f"***{clean_phone[-4:]}" if len(clean_phone) >= 4 else "***"

    @staticmethod
    def _mask_currency(value):
        """Mascara valores monetários (mostra apenas faixa)."""
        try:
            numeric_value = float(value)
            if numeric_value < 100:
                return "MENOR_100"
            elif numeric_value < 500:
                return "100_500"
            elif numeric_value < 1000:
                return "500_1000"
            else:
                return "ACIMA_1000"
        except (ValueError, TypeError):
            return "VALOR_INVALIDO"

    @staticmethod
    def _mask_symptoms(symptoms):
        """Mascara sintomas mantendo contexto mas removendo detalhes sensíveis."""
        if not symptoms or not isinstance(symptoms, str):
            return "***"

        sensitive_terms = [
            r"\b\d{2,}\s*anos?\b",
            r"\b(neto|filho|pai|mãe|avô|avó)\b",
            r"\b(solteiro|casado|divorciado|viúvo)\b",
            r"\b(masculino|feminino)\b",
        ]

        masked_text = symptoms
        for pattern in sensitive_terms:
            masked_text = re.sub(pattern, "***", masked_text, flags=re.IGNORECASE)

        if len(masked_text) > 100:
            masked_text = masked_text[:97] + "..."

        return masked_text

    @staticmethod
    def _mask_generic(value):
        """Mascara genérica para campos não específicos."""
        if not value:
            return "***"

        if not isinstance(value, str):
            return "***"

        if len(value) <= 4:
            return "***"

        return f"{value[:2]}...{value[-2:]}" if len(value) > 4 else "***"
