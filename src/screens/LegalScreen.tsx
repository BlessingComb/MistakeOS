import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../i18n';
import { colors, createThemedStyles, radius, spacing, type } from '../theme';

type LegalDocument = 'privacy' | 'terms' | 'support';
type Props = { document: LegalDocument; onBack: () => void };

const copy = {
  en: {
    privacy: ['Privacy policy', 'Draft — review required before public launch', 'MistakeOS processes your account details and the learning records you choose to create so it can provide the app. Question photos stay on your device in the current phase unless you explicitly request AI analysis. Private mistakes and original photos are never shared automatically with Groups.', 'You can delete your account from Account settings. That deletes your MistakeOS cloud account/data and clears MistakeOS learning data on this device. Store subscriptions must be cancelled in the applicable store.', 'The full operational draft is maintained by the product owner and must be published with the final company name, contact email, effective date and jurisdiction before release.'],
    terms: ['Terms of service', 'Draft — review required before public launch', 'MistakeOS is an educational support tool. It does not guarantee grades, exam outcomes, admission or any other result. AI analysis is optional and may be incomplete or wrong; always verify your own work.', 'Only share content with a Group that you are comfortable making visible to its members. Do not upload personal information about others, student IDs, faces, payment data, secrets or content you do not have the right to use.', 'Paid access, price, renewal, cancellation and refunds are shown by the applicable store. The final terms must be legally reviewed and match the actual offer.'],
    support: ['Help & support', 'Support contact must be configured before public launch', 'For account, privacy or support requests, contact [CONTACT EMAIL]. The product owner must replace this placeholder with a monitored support address before release.', 'Do not include passwords, authentication codes, payment details or other secrets in a support request.'],
  },
  'pt-BR': {
    privacy: ['Política de privacidade', 'Rascunho — exige revisão antes do lançamento público', 'O MistakeOS trata os dados da conta e os registros de aprendizagem que você escolher criar para fornecer o aplicativo. As fotos das questões ficam no dispositivo nesta fase, exceto quando você solicita expressamente uma análise por IA. Erros privados e fotos originais nunca são compartilhados automaticamente com Grupos.', 'Você pode excluir sua conta nos Ajustes da conta. Isso exclui a conta/dados MistakeOS na nuvem e limpa os dados de aprendizagem MistakeOS neste dispositivo. Assinaturas da loja devem ser canceladas na loja correspondente.', 'O rascunho operacional completo é mantido pelo responsável pelo produto e precisa ser publicado com nome legal, e-mail de contato, data de vigência e jurisdição antes do lançamento.'],
    terms: ['Termos de serviço', 'Rascunho — exige revisão antes do lançamento público', 'MistakeOS é uma ferramenta de apoio educacional. Ele não garante notas, resultados de prova, aprovação ou qualquer outro resultado. A análise por IA é opcional e pode estar incompleta ou incorreta; sempre confira seu próprio trabalho.', 'Compartilhe em um Grupo somente conteúdo que você aceita deixar visível aos membros. Não envie dados pessoais de outras pessoas, identificações estudantis, rostos, dados de pagamento, segredos ou conteúdo que você não tem direito de usar.', 'Acesso pago, preço, renovação, cancelamento e reembolsos são apresentados pela loja aplicável. Os termos finais precisam de revisão jurídica e devem corresponder à oferta real.'],
    support: ['Ajuda e suporte', 'O contato de suporte precisa ser configurado antes do lançamento público', 'Para solicitações de conta, privacidade ou suporte, contate [CONTACT EMAIL]. O responsável pelo produto deve trocar este espaço por um e-mail de suporte monitorado antes do lançamento.', 'Não inclua senhas, códigos de autenticação, dados de pagamento ou outros segredos em uma solicitação de suporte.'],
  },
} as const;

export function LegalScreen({ document, onBack }: Props) {
  const { language } = useTranslation();
  const [title, eyebrow, ...paragraphs] = copy[language][document];
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <View style={styles.screen}>
      <Pressable accessibilityRole="button" accessibilityLabel={language === 'pt-BR' ? 'Voltar' : 'Back'} onPress={onBack} style={styles.back}><Feather name="arrow-left" size={19} color={colors.ink} /><Text style={styles.backText}>{language === 'pt-BR' ? 'Voltar' : 'Back'}</Text></Pressable>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {paragraphs.map((paragraph) => <Text key={paragraph} style={styles.body}>{paragraph}</Text>)}
    </View>
  </ScrollView>;
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  scroll: { paddingBottom: 80 },
  screen: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  back: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xl },
  backText: { color: colors.ink, fontFamily: type.bold, fontSize: 13 },
  eyebrow: { color: colors.signal, fontFamily: type.monoBold, fontSize: 8, letterSpacing: 1.05 },
  title: { color: colors.ink, fontFamily: type.extraBold, fontSize: 38, letterSpacing: -1.6, lineHeight: 44, marginTop: spacing.sm },
  body: { color: colors.muted, fontFamily: type.regular, fontSize: 15, lineHeight: 24, marginTop: spacing.lg, backgroundColor: colors.paper, borderRadius: radius.md, padding: spacing.lg },
}));
