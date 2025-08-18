import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { getTemplates, saveTemplate, getTemplateFields } from '../db';

export default function TemplateEditor({ onDone }) {
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [fields, setFields] = useState([]);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    const t = await getTemplates();
    setTemplates(t);
  };

  const edit = async (tpl) => {
    setEditing(tpl);
    setName(tpl.name);
    const f = await getTemplateFields(tpl.id);
    setFields(f.map(ff => ({ fieldKey: ff.fieldKey, label: ff.label })));
  };

  const addField = () => setFields([...fields, { fieldKey: 'field' + (fields.length + 1), label: 'Campo ' + (fields.length + 1) }]);

  const save = async () => {
    const payload = { id: editing ? editing.id : null, name, fields };
    await saveTemplate(payload);
    setEditing(null); setName(''); setFields([]);
    await loadTemplates();
  };

  return (
    <ScrollView style={{ padding: 12 }}>
      <Text>Plantillas</Text>
      {templates.map(t => (
        <Button key={t.id} onPress={() => edit(t)} style={{ marginTop: 8 }}>{t.name}</Button>
      ))}

      <View style={{ marginTop: 16 }}>
        <TextInput label="Nombre de plantilla" value={name} onChangeText={setName} />
        <Text style={{ marginTop: 8 }}>Campos</Text>
        {fields.map((f, idx) => (
          <TextInput key={idx} label="Etiqueta" value={f.label} onChangeText={v => { const copy = [...fields]; copy[idx].label = v; setFields(copy); }} style={{ marginTop: 8 }} />
        ))}
        <Button onPress={addField} style={{ marginTop: 8 }}>Agregar campo</Button>
        <Button mode="contained" onPress={save} style={{ marginTop: 12 }}>Guardar plantilla</Button>
        <Button onPress={() => { setEditing(null); setName(''); setFields([]); }} style={{ marginTop: 8 }}>Nuevo</Button>
        <Button onPress={() => onDone && onDone()} style={{ marginTop: 8 }}>Volver</Button>
      </View>
    </ScrollView>
  );
}
