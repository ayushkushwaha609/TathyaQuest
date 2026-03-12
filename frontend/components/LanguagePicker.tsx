import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LANGUAGES, Language } from '../constants/languages';
import { colors } from '../constants/theme';

interface LanguagePickerProps {
  selectedValue: string;
  onValueChange: (value: string) => void;
}

export const LanguagePicker: React.FC<LanguagePickerProps> = ({
  selectedValue,
  onValueChange,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedLanguage = LANGUAGES.find((lang) => lang.value === selectedValue);

  const handleSelect = (value: string) => {
    onValueChange(value);
    setModalVisible(false);
  };

  const renderItem = ({ item }: { item: Language }) => (
    <TouchableOpacity
      style={[
        styles.option,
        item.value === selectedValue && styles.selectedOption,
      ]}
      onPress={() => handleSelect(item.value)}
    >
      <Text style={styles.optionNative}>{item.nativeLabel}</Text>
      <Text style={styles.optionLabel}>{item.label}</Text>
      {item.value === selectedValue && (
        <Ionicons name="checkmark" size={20} color={colors.saffron} />
      )}
    </TouchableOpacity>
  );

  return (
    <View>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.selectorContent}>
          <Ionicons name="language" size={20} color={colors.ashGray} />
          <Text style={styles.selectorText}>
            {selectedLanguage?.nativeLabel} ({selectedLanguage?.label})
          </Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.ashGray} />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.charcoal} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={LANGUAGES}
              renderItem={renderItem}
              keyExtractor={(item) => item.value}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.sandstone,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectorText: {
    color: colors.charcoal,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.sandstone,
  },
  modalTitle: {
    color: colors.deepIndigo,
    fontSize: 18,
    fontWeight: '600',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  selectedOption: {
    backgroundColor: colors.warmWhite,
  },
  optionNative: {
    color: colors.charcoal,
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
  },
  optionLabel: {
    color: colors.ashGray,
    fontSize: 14,
    marginRight: 12,
  },
});
