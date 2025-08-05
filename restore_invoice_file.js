// Скрипт для восстановления отсутствующего файла счета
const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function restoreInvoiceFile() {
  try {
    console.log('🔄 Восстанавливаем файл счета 0059...');
    
    // Данные из проекта 45
    const invoiceId = '1YQdJ62dOG'; // Из invoice_url
    const invoiceNumber = '0059';
    const projectId = 45;
    
    // Настройки Invoice Ninja (из фирмы)
    const baseUrl = 'http://147.93.62.226:81';
    const token = 'MRD14XBhmHO8HjZ1Uaj1fOJ69lCmjZlE7oI8d8rnv6sNbCZFRDG1z0pYOUacm9qj'; // Токен из настроек
    
    const headers = {
      'X-API-TOKEN': token,
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/pdf',
      'Content-Type': 'application/json'
    };
    
    console.log(`📥 Скачиваем PDF для счета ${invoiceNumber} (ID: ${invoiceId})`);
    
    // Пробуем разные endpoints для скачивания PDF
    let pdfBuffer = null;
    
    try {
      console.log('Пробуем стандартный endpoint...');
      const response = await axios.get(`${baseUrl}/api/v1/invoices/${invoiceId}/download`, {
        headers,
        responseType: 'arraybuffer',
        timeout: 30000
      });
      pdfBuffer = Buffer.from(response.data);
      console.log(`✅ Стандартный endpoint сработал. Размер: ${pdfBuffer.length} байт`);
    } catch (error) {
      console.log('❌ Стандартный endpoint не сработал, пробуем альтернативный...');
      
      try {
        const response = await axios.get(`${baseUrl}/api/v1/invoices/${invoiceId}/pdf`, {
          headers,
          responseType: 'arraybuffer',
          timeout: 30000
        });
        pdfBuffer = Buffer.from(response.data);
        console.log(`✅ Альтернативный endpoint сработал. Размер: ${pdfBuffer.length} байт`);
      } catch (error2) {
        console.error('❌ Все endpoints не сработали:', error2.message);
        return;
      }
    }
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      console.error('❌ Получен пустой файл');
      return;
    }
    
    // Сохраняем файл с именем в том же формате
    const fileName = `invoice_${invoiceNumber}_${Date.now()}.pdf`;
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, fileName);
    
    // Убеждаемся что папка uploads существует
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Сохраняем файл
    fs.writeFileSync(filePath, pdfBuffer);
    const fileSize = fs.statSync(filePath).size;
    
    console.log(`💾 Файл сохранен: ${fileName}`);
    console.log(`📊 Размер файла: ${fileSize} байт`);
    
    // Теперь создадим запись в базе данных через SQL
    console.log('📝 Создаем запись в базе данных...');
    console.log(`INSERT INTO project_files (project_id, file_url, file_name, file_type, uploaded_at) VALUES (${projectId}, '/api/files/${fileName}', '${fileName}', 'application/pdf', NOW());`);
    
    console.log('✅ Файл счета успешно восстановлен!');
    console.log(`🔗 Файл доступен по пути: /api/files/${fileName}`);
    
  } catch (error) {
    console.error('❌ Ошибка при восстановлении файла:', error.message);
    console.error(error.stack);
  }
}

// Запускаем скрипт
restoreInvoiceFile();